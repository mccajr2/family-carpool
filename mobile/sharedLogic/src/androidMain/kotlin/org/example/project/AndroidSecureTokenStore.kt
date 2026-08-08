package org.example.project

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class AndroidSecureTokenStore(
    context: Context,
) : SecureTokenStore {
    private val prefs =
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )

    override fun saveAccessToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    override fun loadAccessToken(): String? = prefs.getString(KEY_TOKEN, null)

    override fun clear() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    companion object {
        private const val PREFS_NAME = "family_carpool_auth"
        private const val KEY_TOKEN = "access_token"
    }
}
