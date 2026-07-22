/**
 * Expo Config Plugin: 添加 Android Network Security Config
 *
 * Android 14+ 即使 usesCleartextTraffic=true 也会拦截 localhost HTTP。
 * 这个 plugin 在 AndroidManifest 加 networkSecurityConfig 引用，
 * 并创建 res/xml/network_security_config.xml 明确放行 localhost。
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const path = require('path')
const fs = require('fs')

const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">127.0.0.1</domain>
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">192.168.0.0/16</domain>
    <domain includeSubdomains="true">10.0.0.0/8</domain>
  </domain-config>
</network-security-config>
`

module.exports = function withNetworkSecurityConfig(config) {
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults?.manifest?.application?.[0]
    if (app?.$) {
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config'
    }
    return cfg
  })

  config = withDangerousMod(config, ['android', (cfg) => {
    const xmlDir = path.join(
      cfg.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'res', 'xml',
    )
    fs.mkdirSync(xmlDir, { recursive: true })
    fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), XML, 'utf-8')
    return cfg
  }])

  return config
}
