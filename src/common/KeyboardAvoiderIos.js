/* @flow strict-local */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { Node } from 'react';
import { View, Keyboard, useWindowDimensions, Platform } from 'react-native';
import type { ViewStyleProp } from 'react-native/Libraries/StyleSheet/StyleSheet';
import type { IOSKeyboardEvent } from 'react-native/Libraries/Components/Keyboard/Keyboard';
import invariant from 'invariant';

type Props = $ReadOnly<{|
  children: Node,
  style?: ViewStyleProp,
  contentContainerStyle?: ViewStyleProp,
|}>;

type Measurements = null | $ReadOnly<{| x: number, y: number, width: number, height: number |}>;

/**
 * The near-current value of viewRef.measureInWindow; reacts to layout changes
 *
 * The returned `onLayout` function must be supplied to the View; see
 *   https://reactnative.dev/docs/view#onlayout.
 *
 * See also the doc for viewRef.measureInWindow:
 *   https://reactnative.dev/docs/0.64/direct-manipulation#measureinwindowcallback
 *
 * "Near-current" because viewRef.measureInWindow is an asynchronous query;
 * experimentally, it seems to take 10-50ms.
 *
 * The X and Y coordinates passed to the `onLayout` callback are relative to
 * the parent view. `measureInWindow` gives you coordinates relative to the
 * entire window, which is often more useful -- but RN doesn't give us a
 * direct hook into when `measureInWindow`'s result changes. This is meant
 * to address that lack.
 */
function useViewMeasurementsInWindow(viewRef) {
  const counter = useRef<number>(0);
  const [measurements, setMeasurements] = useState<Measurements>(null);

  const onLayout = useCallback(
    _ => {
      // Ignore the data passed to the callback; we just want to make sure
      // `measureInWindow` runs on each layout change.

      counter.current++;
      const counterValueNow = counter.current;

      if (!viewRef.current) {
        return;
      }

      viewRef.current.measureInWindow((x, y, width, height) => {
        // `measureInWindow` is asynchronous. If another `measureInWindow`
        // started while we were waiting for this one, don't commit the
        // result. Otherwise, do.
        if (counterValueNow === counter.current) {
          setMeasurements({ x, y, width, height });
          counter.current %= Number.MAX_SAFE_INTEGER;
        }
      });
    },
    [viewRef],
  );

  return {
    onLayout,
    measurements,
  };
}

/**
 * Like RN's `KeyboardAvoidingView`, but with some assumptions/improvements.
 *
 * Unlike `KeyboardAvoidingView`, we assume:
 * - We're on iOS
 * - The offset is done with padding (like `behavior="padding"`)
 *
 * We make these improvements (as of RN v0.64):
 * - No fiddly `keyboardVerticalOffset` that no one understands (see
 *   our 70eca0716)
 * - It works even when the user has enabled "Prefer Cross-Fade Transitions"
 *   (UIAccessibilityPrefersCrossFadeTransitions); see
 *     https://github.com/facebook/react-native/issues/29974
 * - We hope to make it happier code (easier to read, debug, maintain, etc.)
 *
 * Experimentally, this seems to work well for the normal case of opening
 * and closing the keyboard. There's jank on screen-orientation changes,
 * though; `KeyboardAvoidingView` has jank too.
 */
// TODO(tests): Could write some tests for this component; see
//   `useHasStayedTrueForMs` for testing a Hook, and for another possible
//   approach, see
//   https://github.com/zulip/zulip-mobile/pull/4997#issuecomment-916457062.
//   However, we rely heavily on notifications from the native layout
//   (onLayout, measureInWindow, useWindowDimensions, Keyboard.addListener),
//   and those seem pretty fundamentally hard to account for in tests.
// TODO(jank): We *really* want to rewrite this with a native component that
//   uses UIKeyboardLayoutGuide (iOS 15+). Is it even possible to have React
//   Native components respect Auto Layout constraints? See
//     https://developer.apple.com/documentation/uikit/uiview/3752221-keyboardlayoutguide?language=objc
//   and
//     https://developer.apple.com/videos/play/wwdc2021/10259/ (watch the
//   first ~4min of the video, it's fascinating!) and
//     https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/AutolayoutPG/index.html
export default function KeyboardAvoiderIos(props: Props): Node {
  // TODO(jank): This is likely to race with our other dimensions-change
  //   listeners, right?
  const { height: windowHeight } = useWindowDimensions();

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardScreenY, setKeyboardScreenY] = useState(windowHeight);

  const viewRef = useRef();
  // TODO(jank): Noticeable jank on screen orientation changes; see the
  //   "near-current" caveat in useViewMeasurementsInWindow. That caveat
  //   shouldn't affect the normal keyboard-open-close animations, because
  //   we don't expect the View to change its height or its Y-in-window
  //   coordinate during those (only its padding is changed).
  const { onLayout, measurements: viewMeasurementsInWindow } = useViewMeasurementsInWindow(viewRef);

  useEffect(() => {
    invariant(Platform.OS === 'ios', 'KeyboardAvoiderIos expected to be on iOS');

    // TODO(jank): This is likely to race with our other dimensions-change
    //   listeners, right?
    const sub = Keyboard.addListener('keyboardWillChangeFrame', (e: IOSKeyboardEvent) => {
      if (e.duration > 10) {
        // Two reasons for this conditional:
        //
        // (1) As of RN v0.64, `LayoutAnimation.configureNext` (called by
        //     Keyboard.scheduleLayoutAnimation) on iOS assumes callers that
        //     pass a `duration` value of <10 mean seconds instead of
        //     milliseconds, and it errors. See
        //       https://reactnative.dev/docs/keyboard#schedulelayoutanimation
        //     and these implementations:
        //       * `Keyboard.scheduleLayoutAnimation`
        //       * `LayoutAnimation.configureNext`; see in RCTLayoutAnimation.m:
        //           - (instancetype)initWithDuration:(NSTimeInterval)duration config:(NSDictionary *)config
        //
        // (2) Frame changes are caused by opening and closing the keyboard,
        //     but other things cause frame changes too, like screen
        //     orientation changes. In all cases, we want to update our
        //     state with the keyboard's current height and Y coordinate so
        //     we can set `bottomPadding` correctly; see below. But this
        //     component shouldn't provide animations on all frame changes,
        //     only for opening and closing the keyboard. Empirically, all
        //     events that don't represent keyboard open-and-close seem to
        //     have duration 0.
        Keyboard.scheduleLayoutAnimation(e);
      }
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardScreenY(e.endCoordinates.screenY);
    });
    return () => sub.remove();
  }, []);

  let paddingBottom = undefined;
  if (!viewMeasurementsInWindow) {
    paddingBottom = 0;
  } else {
    const {
      y: viewYInWindow,
      height: viewHeight,
      // ignore view x and width
    } = viewMeasurementsInWindow;

    // In most environments, `endKeyboardHeight` is some positive value,
    // and `endKeyboardY` goes between `windowHeight` (on closing the
    // keyboard) and something less than `windowHeight` (on opening it).
    //
    // If UIAccessibilityPrefersCrossFadeTransitions, then on closing
    // the keyboard, *everything* in `endCoordinates` will be zero,
    // including `endKeyboardHeight`. As far as I can tell from reading
    // code, those `endCoordinates` values are pretty much passed
    // through from Apple untouched. See facebook/react-native#29974.
    //
    // We handle both cases with this expression.
    const isKeyboardOpen = keyboardScreenY < windowHeight && keyboardHeight > 0;

    paddingBottom = isKeyboardOpen ? viewYInWindow + viewHeight - keyboardScreenY : 0;
  }

  return (
    <View style={[props.style, { paddingBottom }]} ref={viewRef} onLayout={onLayout}>
      {props.children}
    </View>
  );
}
