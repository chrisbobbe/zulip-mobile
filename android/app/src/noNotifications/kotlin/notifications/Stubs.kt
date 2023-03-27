package com.zulipmobile.notifications

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager

public class NotificationChannelManager {
    companion object {
        @JvmStatic
        fun createNotificationChannel(context: Context) {
            // do nothing
        }
    }
}

internal class NotificationsModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "Notifications"
    }

    override fun getConstants(): MutableMap<String, Any> =
        hashMapOf("isNoNotificationsBuild" to true)

    @ReactMethod
    fun getToken(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun readInitialNotification(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun googlePlayServicesAvailability(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun areNotificationsEnabled(promise: Promise) {
        promise.resolve(null)
    }
}

class NotificationsPackage : ReactPackage {
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(NotificationsModule(reactContext))
    }
}

internal fun maybeHandleViewNotif(intent: Intent, maybeReactContext: ReactContext?): Boolean {
    // do nothing
    return false
}
