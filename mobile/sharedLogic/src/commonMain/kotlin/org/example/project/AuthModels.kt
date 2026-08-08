package org.example.project

import kotlinx.serialization.Serializable

@Serializable
data class Adult(
    val id: String,
    val email: String,
    val displayName: String? = null,
)

@Serializable
data class RequestAuthCodeResponse(
    val email: String,
    val expiresInSeconds: Int,
    val devCode: String? = null,
)

@Serializable
data class AuthSessionResponse(
    val accessToken: String,
    val tokenType: String,
    val adult: Adult,
)

@Serializable
data class ErrorBody(
    val message: String,
)
