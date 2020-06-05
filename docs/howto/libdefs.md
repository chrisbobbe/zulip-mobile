# Libdefs

Libdefs, or "library definitions", are files we use to annotate
third-party code, when that code isn't well-typed. You can read more
about Flow libdefs [here](https://flow.org/en/docs/libdefs/).

Sometimes, installing a Flow libdef is as simple as, for an NPM
package named "foo", `flow-typed install foo`. This depends on
`flow-typed` being aware of a libdef for `foo`. FlowTyped maintains a
repository that people contribute libdefs to, and `flow-typed install`
checks that repository.

Sometimes, a published libdef doesn't exist, and in that case, more
work is involved. This doc is meant to be updated with anecdotes or
general workflow patterns in the effort to get our third-party
dependencies well-typed.

-----

## `remotedev-serialize`

Some assembly was required for a libdef for `remotedev-serialize`, but
it was important to get one working [1]. Here's a summary of what that
was like.

1. Check to see if someone has already submitted a libdef to
   FlowTyped, with `flow-typed install remotedev-serialize`. They
   haven't; we get the output, '!! No flow@v0.92.0-compatible libdefs
   found in flow-typed for the explicitly requested libdefs. !!
   Consider using `flow-typed create-stub remotedev-serialize` to
   generate an empty libdef that you can fill in.'.

2. As that output suggests, run

   `flow-typed create-stub remotedev-serialize`

   . This creates `flow-typed/npm/remotedev-serialize_vx.x.x.js` and
   fills it with a template based on the directory structure in
   `node_modules/remotedev-serialize`. Move this to
   `flow-typed/remotedev-serialize_vx.x.x.js` (no `npm`) because we
   want to maintain it locally; we don't want local adjustments we
   make to get clobbered by an eventual libdef in the FlowTyped repo.
   Delete the metadata lines at the top; they work as a tag on libdef
   contents that come from the FlowTyped repo, which this one doesn't
   [2].

3. Here, we could enter everything in manually, but it turns out that
   DefinitelyTyped has a TypeScript libdef for `remotedev-serialize`
   [3], which we can use as a starting point. So, copy that into a
   temporary local text file as, e.g., libdef.d.ts.

4. Flowgen [4] [5] [6] is a tool for translating from TypeScript to
   Flow. It isn't perfect, and it's transparent about that, which is
   good to see. We just need this single file translated, and it's
   small, so that increases our chances of success. Run `flowgen
   libdef.d.ts`.

5. That output isn't exactly in the form that we want, though. We want
   to put this information in
   `flow-typed/remotedev-serialize_vx.x.x.js` from step 2, in this
   block:

   ```
   declare module 'remotedev-serialize' {
     declare module.exports: any;
   }
   ```

   Copy it into that block, in any case, deleting the `declare
   module.exports: any;` line (we favor ES modules over CommonJS
   modules) and observe the errors.

6. The minimal set of changes to get it working was

   A) replace 'export' with 'declare export' [7]

   B) replace `typeof Immutable` with `any` and remove the Immutable
      import. You can't import types from other libdefs in a libdef
      [8].

7. Step 2 created a lot of extra stubs in case we wanted to make a
   libdef for every single file in `node_modules/remotedev-serialize`.
   We never import directly from these other files, so it's fine to
   just put all the type information in a single libdef, as we did in
   the copy-and-paste in step 5. Delete those extra, unnecessary
   stubs.

[1]: https://flow.org/en/docs/libdefs/#toc-general-best-practices
[2]: https://chat.zulip.org/#narrow/stream/243-mobile-team/topic/Android.20build.3A.20unimodules/near/859855
[3]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/55ebcedca/types/remotedev-serialize/index.d.ts.
[4]: https://github.com/joarwilk/flowgen
[5]: https://github.com/zulip/zulip-mobile/issues/3458#issuecomment-542870835
[6]: https://chat.zulip.org/#narrow/stream/243-mobile-team/topic/Android.20build.3A.20unimodules/near/845802
[7]: https://flow.org/en/docs/libdefs/creation/
[8]: https://github.com/flow-typed/flow-typed/blob/master/CONTRIBUTING.md#dont-import-types-from-other-libdefs

## `react-native-webview` at v7.6

The latest version FlowTyped has a libdef for is 6, unfortunately.

Ah, well. I made a best effort at replicating the types at
`react-native-community/react-native-webview@c4001338c`, tagged as
v7.6.0, the latest 7.x.

I used FlowType's `react-native-webview` v6 libdef as a starting
point, to match any conventions that may have been established after
the v5 libdef we were on before. Then, I ran the following in the
`react-native-webview` repo, which I had cloned:

```bash
git diff v6.8.0..v7.6.0 -- src/WebViewTypes.ts
```

I then went through the diff and did my best to apply each change,
blending in with the local style. The most prominent example of this
blending in was using, e.g.,

```javascript
onHttpError?: WebViewHttpErrorEvent => mixed,
```

instead of

```javascript
onHttpError?: (event: WebViewHttpErrorEvent) => void,
```

which would be valid Flow but wouldn't blend in with similar event
handlers.

One choice that proved helpful was to *not* start at the top of the
diff and work my way down, but to find changes to the major types
that the Flow libdef needs to export, and start there, following
through with any changes to auxiliary types that those changes
depend on. There were many changes in the TypeScript that didn't
affect anything that our libdef exports, and these were rightfully
and automatically ignored with this approach, saving time.

Like with v5, though, the v6 libdef was lacking most of the JSDocs,
and several properties were needlessly in a different order than in
the TypeScript, so once I was basically familiar with the changes I
needed to take, I went through
`react-native-community/react-native-webview@c4001338c` and fixed
the ordering and copied over lots of comments.
