package com.iigrain

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Dns
import okhttp3.OkHttpClient
import java.net.Inet4Address
import java.net.InetAddress

/**
 * Prefer IPv4 for every network request the app makes.
 *
 * The API host is DUAL-STACK (it publishes both an A / IPv4 and an AAAA / IPv6
 * record). Many networks and (especially) Android emulators advertise IPv6 but
 * can't actually route it, so an IPv6-first connection attempt stalls for a few
 * seconds and then surfaces to JS as a transport "Network Error" - even though
 * the server, TLS and certificate are all fine. Returning the IPv4 address(es)
 * first (and keeping any others as a fallback) skips that dead path. This is
 * harmless on real IPv4 or IPv6 networks, and the host is reachable over IPv4.
 */
private object Ipv4PreferredDns : Dns {
  override fun lookup(hostname: String): List<InetAddress> {
    val addresses = Dns.SYSTEM.lookup(hostname)
    val ipv4 = addresses.filterIsInstance<Inet4Address>()
    if (ipv4.isEmpty()) {
      return addresses
    }
    // IPv4 first, then anything else (e.g. IPv6) as a fallback.
    return ipv4 + addresses.filter { it !is Inet4Address }
  }
}

private class Ipv4OkHttpClientFactory : OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): OkHttpClient =
    OkHttpClientProvider.createClientBuilder()
      .dns(Ipv4PreferredDns)
      .build()
}

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Route React Native's networking through an IPv4-preferred OkHttp client
    // (see Ipv4PreferredDns) BEFORE React Native initializes its network module.
    OkHttpClientProvider.setOkHttpClientFactory(Ipv4OkHttpClientFactory())
    loadReactNative(this)
  }
}
