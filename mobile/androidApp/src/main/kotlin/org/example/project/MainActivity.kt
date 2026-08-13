package org.example.project

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.remember

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            val session =
                remember {
                    AuthSession(tokenStore = AndroidSecureTokenStore(applicationContext))
                }
            val calendarCacheStore =
                remember {
                    AndroidCalendarCacheStore(applicationContext)
                }
            App(session = session, calendarCacheStore = calendarCacheStore)
        }
    }
}
