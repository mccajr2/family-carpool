package org.example.project

class Greeting(
    private val client: GreetingClient = GreetingClient.create(),
    private val greetingName: String = getPlatform().name,
) {
    suspend fun greet(): String = client.fetchGreeting(greetingName)
}
