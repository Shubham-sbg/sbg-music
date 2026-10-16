import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import sharp from 'sharp';
import { SBG_APP_ICON_SVG } from './generate-branding-assets';

const ROOT_DIR = process.cwd();
const ANDROID_BUILD_DIR = path.join(ROOT_DIR, 'android-build');
const PUBLIC_DOWNLOADS_DIR = path.join(ROOT_DIR, 'public', 'downloads');
const FRAMEWORK_RES_PATH = '/usr/share/android-framework-res/framework-res.apk';
const ANDROID_JAR_PATH = '/usr/lib/android-sdk/platforms/android-23/android.jar';

function getJavacCmd(): string {
  if (fs.existsSync('/usr/lib/jvm/java-17-openjdk-amd64/bin/javac')) {
    return '/usr/lib/jvm/java-17-openjdk-amd64/bin/javac';
  }
  try {
    return execSync('which javac').toString().trim();
  } catch {
    return 'javac';
  }
}

function getDxCmd(): string {
  if (fs.existsSync('/usr/lib/android-sdk/build-tools/debian/dx')) {
    return '/usr/lib/android-sdk/build-tools/debian/dx';
  }
  try {
    return execSync('which dx').toString().trim();
  } catch {
    return 'dx';
  }
}

fs.mkdirSync(ANDROID_BUILD_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DOWNLOADS_DIR, { recursive: true });

async function generateLauncherIcons(resDir: string) {
  const iconBuffer = Buffer.from(SBG_APP_ICON_SVG);

  const densities: { name: string; size: number }[] = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const { name, size } of densities) {
    const dir = path.join(resDir, name);
    fs.mkdirSync(dir, { recursive: true });

    // Square launcher icon
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Round launcher icon
    const circleSvg = Buffer.from(
      `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#000"/></svg>`
    );
    const circleMask = await sharp(circleSvg).resize(size, size).png().toBuffer();

    await sharp(iconBuffer)
      .resize(size, size)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
  }
}

async function main() {
  console.log('==================================================');
  console.log('SBG MUSIC — PRODUCTION RELEASE APK BUILD PIPELINE');
  console.log('==================================================');

  // 1. Clean and setup directories
  const srcDir = path.join(ANDROID_BUILD_DIR, 'src', 'com', 'sbg', 'music');
  const resDir = path.join(ANDROID_BUILD_DIR, 'res');
  const valuesDir = path.join(resDir, 'values');
  const classesDir = path.join(ANDROID_BUILD_DIR, 'classes');

  fs.rmSync(ANDROID_BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(classesDir, { recursive: true });

  // 2. Generate Mipmap Icons
  console.log('[APK Build] Generating official launcher icons...');
  await generateLauncherIcons(resDir);

  // 3. Generate res/values/strings.xml
  fs.writeFileSync(
    path.join(valuesDir, 'strings.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">SBG MUSIC</string>
</resources>`
  );

  // 4. Create AndroidManifest.xml
  console.log('[APK Build] Generating AndroidManifest.xml with Android 11-15 permissions...');
  const manifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.sbg.music"
    android:versionCode="20400"
    android:versionName="2.4.0">

    <uses-sdk
        android:minSdkVersion="21"
        android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">

        <activity
            android:name="com.sbg.music.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name="com.sbg.music.BackgroundMediaService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
    </application>
</manifest>`;
  fs.writeFileSync(path.join(ANDROID_BUILD_DIR, 'AndroidManifest.xml'), manifestContent);

  // 5. Generate Java source code
  console.log('[APK Build] Generating production Java source code (MainActivity & BackgroundMediaService)...');
  const mainActivityJava = `package com.sbg.music;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.KeyEvent;
import android.graphics.Color;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#121214"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUserAgentString(settings.getUserAgentString() + " SBGMusicApp/2.4.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        setContentView(webView);
        webView.loadUrl("https://sbg-song.vercel.app");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
`;
  fs.writeFileSync(path.join(srcDir, 'MainActivity.java'), mainActivityJava);

  const backgroundServiceJava = `package com.sbg.music;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public class BackgroundMediaService extends Service {
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }
}
`;
  fs.writeFileSync(path.join(srcDir, 'BackgroundMediaService.java'), backgroundServiceJava);

  // 6. Compile Java to class files
  const javacPath = getJavacCmd();
  const dxPath = getDxCmd();
  console.log(`[APK Build] Compiling Java source with ${javacPath} -source 8 -target 8...`);
  execSync(
    `"${javacPath}" -source 8 -target 8 -cp "${ANDROID_JAR_PATH}" -d "${classesDir}" "${path.join(srcDir, 'MainActivity.java')}" "${path.join(srcDir, 'BackgroundMediaService.java')}"`,
    { stdio: 'inherit' }
  );

  // 7. Convert class files to Dalvik bytecode (classes.dex)
  console.log(`[APK Build] Converting classes to Dalvik DEX format with ${dxPath}...`);
  const dexPath = path.join(ANDROID_BUILD_DIR, 'classes.dex');
  execSync(`"${dxPath}" --dex --output="${dexPath}" "${classesDir}"`, { stdio: 'inherit' });

  // 8. Compile binary resources and manifest using aapt
  console.log('[APK Build] Compiling resources and Binary AndroidManifest.xml with aapt...');
  const unsignedApkPath = path.join(ANDROID_BUILD_DIR, 'app.unsigned.apk');
  execSync(
    `aapt package -f -m -F "${unsignedApkPath}" -M "${path.join(ANDROID_BUILD_DIR, 'AndroidManifest.xml')}" -S "${resDir}" -I "${FRAMEWORK_RES_PATH}"`,
    { stdio: 'inherit' }
  );

  // 9. Add classes.dex into the APK
  console.log('[APK Build] Packaging classes.dex into APK...');
  execSync(`cd "${ANDROID_BUILD_DIR}" && aapt add app.unsigned.apk classes.dex`, { stdio: 'inherit' });

  // 10. Align APK on 4-byte boundaries with zipalign
  console.log('[APK Build] Running zipalign...');
  const alignedApkPath = path.join(ANDROID_BUILD_DIR, 'app.aligned.apk');
  execSync(`zipalign -f -p 4 "${unsignedApkPath}" "${alignedApkPath}"`, { stdio: 'inherit' });

  // 11. Create Release Keystore & Sign APK with jarsigner (v1) + apksigner (v2 + v3)
  console.log('[APK Build] Generating release keystore and signing with jarsigner (v1) and apksigner (v2)...');
  const keystorePath = path.join(ANDROID_BUILD_DIR, 'sbg-release.keystore');
  if (!fs.existsSync(keystorePath)) {
    execSync(
      `keytool -genkeypair -v -keystore "${keystorePath}" -storepass sbgmusic2026 -alias sbgmusic -keypass sbgmusic2026 -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SBG MUSIC, OU=SBG INDUSTRY, O=SBG ESPORTS, C=IN"`,
      { stdio: 'ignore' }
    );
  }

  // v1 signature with jarsigner
  execSync(
    `jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore "${keystorePath}" -storepass sbgmusic2026 "${alignedApkPath}" sbgmusic`,
    { stdio: 'inherit' }
  );

  const finalApkPath = path.join(ANDROID_BUILD_DIR, 'SBG-Music-v2.4.0.apk');
  execSync(
    `apksigner sign --min-sdk-version 21 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --ks "${keystorePath}" --ks-pass pass:sbgmusic2026 --key-pass pass:sbgmusic2026 --ks-key-alias sbgmusic --out "${finalApkPath}" "${alignedApkPath}"`,
    { stdio: 'inherit' }
  );

  // 12. Validate Release APK with apksigner verify
  console.log('[APK Build] Validating signed APK with apksigner verify (minSdkVersion 21)...');
  const verifyOutput = execSync(`apksigner verify --verbose --min-sdk-version 21 "${finalApkPath}"`).toString();
  console.log(verifyOutput);

  // 13. Dump APK badging with aapt to verify manifest
  console.log('[APK Build] Dumping APK badging with aapt...');
  const badgingOutput = execSync(`aapt dump badging "${finalApkPath}" | head -n 12`).toString();
  console.log(badgingOutput);

  // 14. Calculate SHA-256 and file size
  const apkBytes = fs.readFileSync(finalApkPath);
  const sha256 = crypto.createHash('sha256').update(apkBytes).digest('hex');
  const sizeMb = (apkBytes.length / (1024 * 1024)).toFixed(2);

  // 15. Copy to public downloads
  const targetApk1 = path.join(PUBLIC_DOWNLOADS_DIR, 'sbg-music.apk');
  const targetApk2 = path.join(PUBLIC_DOWNLOADS_DIR, 'sbg-music-v2.4.0.apk');
  fs.copyFileSync(finalApkPath, targetApk1);
  fs.copyFileSync(finalApkPath, targetApk2);

  // Save metadata
  const metadata = {
    appName: 'SBG MUSIC',
    packageName: 'com.sbg.music',
    versionName: '2.4.0',
    versionCode: 20400,
    minSdkVersion: 21,
    targetSdkVersion: 34,
    supportedAndroidVersions: 'Android 5.0+ (Lollipop, Marshmallow, Nougat, Oreo, Pie, 10, 11, 12, 13, 14, 15)',
    supportedArchitectures: 'universal (arm64-v8a, armeabi-v7a, x86_64, x86)',
    sizeBytes: apkBytes.length,
    sizeFormatted: `${sizeMb} MB`,
    sha256Checksum: sha256,
    signingScheme: 'v1 (JAR) + v2 (APK Signature) + v3',
    builtAt: new Date().toISOString(),
    status: 'PRODUCTION_VERIFIED_VALID',
  };

  const metadataPath = path.join(PUBLIC_DOWNLOADS_DIR, 'release-info.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log('==================================================');
  console.log('✓ RELEASE APK BUILT & VALIDATED SUCCESSFULLY!');
  console.log(`Package: ${metadata.packageName}`);
  console.log(`Version: ${metadata.versionName} (code: ${metadata.versionCode})`);
  console.log(`Size: ${metadata.sizeFormatted}`);
  console.log(`SHA-256: ${sha256}`);
  console.log('==================================================');
}

main().catch((err) => {
  console.error('[APK Build] Fatal error:', err);
  process.exit(1);
});
