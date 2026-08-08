package org.example.project

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryAddValue
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFTypeRefVar
import platform.CoreFoundation.kCFAllocatorDefault
import platform.CoreFoundation.kCFBooleanTrue
import platform.Foundation.CFBridgingRelease
import platform.Foundation.CFBridgingRetain
import platform.Foundation.NSData
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

/**
 * iOS Keychain-backed Bearer token store.
 */
@OptIn(ExperimentalForeignApi::class, kotlinx.cinterop.BetaInteropApi::class)
class IosSecureTokenStore : SecureTokenStore {
    override fun saveAccessToken(token: String) {
        clear()
        val nsToken = NSString.create(string = token)
        val data = nsToken.dataUsingEncoding(NSUTF8StringEncoding) ?: return
        val query = CFDictionaryCreateMutable(kCFAllocatorDefault, 0, null, null) ?: return
        CFDictionaryAddValue(query, kSecClass, kSecClassGenericPassword)
        CFDictionaryAddValue(query, kSecAttrService, CFBridgingRetain(SERVICE))
        CFDictionaryAddValue(query, kSecAttrAccount, CFBridgingRetain(ACCOUNT))
        CFDictionaryAddValue(query, kSecValueData, CFBridgingRetain(data))
        SecItemAdd(query, null)
    }

    override fun loadAccessToken(): String? =
        memScoped {
            val query = CFDictionaryCreateMutable(kCFAllocatorDefault, 0, null, null) ?: return null
            CFDictionaryAddValue(query, kSecClass, kSecClassGenericPassword)
            CFDictionaryAddValue(query, kSecAttrService, CFBridgingRetain(SERVICE))
            CFDictionaryAddValue(query, kSecAttrAccount, CFBridgingRetain(ACCOUNT))
            CFDictionaryAddValue(query, kSecReturnData, kCFBooleanTrue)
            CFDictionaryAddValue(query, kSecMatchLimit, kSecMatchLimitOne)
            val result = alloc<CFTypeRefVar>()
            val status = SecItemCopyMatching(query, result.ptr)
            if (status != errSecSuccess) {
                return null
            }
            val data = CFBridgingRelease(result.value) as? NSData ?: return null
            return NSString.create(data, NSUTF8StringEncoding)?.toString()
        }

    override fun clear() {
        val query = CFDictionaryCreateMutable(kCFAllocatorDefault, 0, null, null) ?: return
        CFDictionaryAddValue(query, kSecClass, kSecClassGenericPassword)
        CFDictionaryAddValue(query, kSecAttrService, CFBridgingRetain(SERVICE))
        CFDictionaryAddValue(query, kSecAttrAccount, CFBridgingRetain(ACCOUNT))
        SecItemDelete(query)
    }

    companion object {
        private const val SERVICE = "org.example.project.auth"
        private const val ACCOUNT = "access_token"
    }
}
