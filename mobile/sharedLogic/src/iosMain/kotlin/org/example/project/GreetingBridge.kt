package org.example.project

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class GreetingBridge {
    private val greeting = Greeting()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    fun fetchGreeting(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                onSuccess(greeting.greet())
            } catch (e: Throwable) {
                onError(e.message ?: "Request failed")
            }
        }
    }
}
