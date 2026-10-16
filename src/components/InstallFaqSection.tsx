import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  AlertTriangle, 
  FileWarning, 
  CheckCircle2, 
  Settings, 
  ExternalLink,
  ShieldCheck,
  Smartphone,
  HardDrive,
  RefreshCw,
  Info
} from 'lucide-react';

interface FaqItem {
  id: string;
  category: 'play_protect' | 'parse_error' | 'not_installed' | 'permissions';
  badge: string;
  badgeColor: string;
  question: string;
  summary: string;
  solutionSteps: {
    step: string;
    detail: string;
    highlight?: string;
  }[];
  proTip?: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'play_protect',
    category: 'play_protect',
    badge: 'Play Protect',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    question: 'How to bypass "Blocked by Play Protect" or "Unrecognized App" warning?',
    summary: 'Google Play Protect automatically flags direct APK files downloaded outside the Google Play Store because they are not distributed through Google’s store servers.',
    solutionSteps: [
      {
        step: '1. Look for "More details"',
        detail: 'When the Play Protect alert dialog pops up, DO NOT tap "OK" or "Don\'t Install". Instead, look below the message and tap the small text link labeled',
        highlight: '"More details" (or the drop-down arrow ▾)',
      },
      {
        step: '2. Select "Install anyway"',
        detail: 'After expanding "More details", a new button will appear. Tap',
        highlight: '"Install anyway" (or "Install anyway (unsafe)")',
      },
      {
        step: '3. Complete the installation',
        detail: 'The Android package manager will immediately proceed with installing SBG MUSIC onto your device.',
      },
      {
        step: 'Alternative: Temporarily disable Play Protect',
        detail: 'Open Google Play Store → tap your Profile icon (top-right) → tap "Play Protect" → tap the Settings gear icon (top-right) → temporarily toggle off "Scan apps with Play Protect" while installing.',
      },
    ],
    proTip: 'SBG MUSIC is a clean, verified APK digitally signed by the developer. It contains no adware, tracking bloat, or background telemetry.',
  },
  {
    id: 'parse_error',
    category: 'parse_error',
    badge: 'Parse Error',
    badgeColor: 'bg-red-500/15 text-red-300 border-red-500/30',
    question: 'How to fix "Parse Error: There was a problem parsing the package"?',
    summary: 'A parse error is a common false-positive warning for sideloaded APKs. It usually means the APK file was not downloaded completely, the browser altered the file extension, or an older build signature conflicted.',
    solutionSteps: [
      {
        step: '1. Re-download to ensure a complete file',
        detail: 'If your internet connection dropped during download, the APK file may be incomplete. Tap the "Download Android APK" button above to get a fresh copy.',
        highlight: 'Verify the file download completes fully.',
      },
      {
        step: '2. Verify file extension in File Manager',
        detail: 'Certain default browsers (like Mi Browser or UC Browser) rename files to .apk.bin or .apk.zip. Open your phone\'s File Manager (or "Files by Google"), find the file in Downloads, and ensure the filename ends strictly with',
        highlight: '.apk (e.g., SBG-Music-v2.4.0.apk)',
      },
      {
        step: '3. Check Android OS Version',
        detail: 'SBG MUSIC requires Android 5.0 (Lollipop) or newer. Go to phone Settings → About Phone → Android Version. All modern Android versions (10, 11, 12, 13, 14, 15) are fully supported.',
      },
      {
        step: '4. Clear Package Installer Cache',
        detail: 'Go to phone Settings → Apps → Show System Apps → "Package Installer" → Storage → Clear Cache, then restart your phone and try again.',
      },
    ],
    proTip: 'We recommend using Google Chrome or Samsung Internet to download the APK directly without file-renaming issues.',
  },
  {
    id: 'not_installed',
    category: 'not_installed',
    badge: 'App Not Installed',
    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    question: 'How to resolve "App not installed" error?',
    summary: 'This error occurs when an older conflicting version of the app exists with a mismatched signature, internal storage is too low, or an uninstallation was incomplete.',
    solutionSteps: [
      {
        step: '1. Uninstall any previous SBG Music build',
        detail: 'If you have an older release or beta APK installed, Android may prevent overwriting if keystore signatures differ. Go to phone Settings → Apps → SBG Music → tap',
        highlight: '"Uninstall" before installing the new APK',
      },
      {
        step: '2. Free up internal storage space',
        detail: 'Ensure your Android device has at least 150 MB of free internal storage. If your storage is critically full (99%+), the Android OS refuses to register new application packages.',
      },
      {
        step: '3. Install from Default File Manager',
        detail: 'Instead of tapping the file directly inside third-party apps like WhatsApp or Telegram, open your device\'s built-in "Files" app → navigate to "Downloads" → tap the APK to install.',
      },
      {
        step: '4. Restart your device',
        detail: 'A quick device reboot clears stuck PackageInstaller lock files that can hold onto stale application IDs.',
      },
    ],
    proTip: 'Uninstalling an older version takes 5 seconds and resolves 95% of "App not installed" conflicts immediately.',
  },
  {
    id: 'permissions',
    category: 'permissions',
    badge: 'Permissions',
    badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    question: 'How to enable "Install Unknown Apps" permission in Android Settings?',
    summary: 'Starting in Android 8.0 (Oreo) and continuing in Android 9, 10, 11, 12, 13, 14, and 15, Android requires users to grant installation permission to each browser individually.',
    solutionSteps: [
      {
        step: '1. Tap "Settings" when prompted',
        detail: 'When you tap the downloaded APK, Android will show a prompt: "For your security, your phone is not allowed to install unknown apps from this source." Tap',
        highlight: '"Settings" on the prompt dialog',
      },
      {
        step: '2. Toggle "Allow from this source"',
        detail: 'Turn the switch ON next to',
        highlight: '"Allow from this source" (or "Trust this source")',
      },
      {
        step: '3. Tap Back to Install',
        detail: 'Press the Back button once. The installation screen will appear with an "Install" button. Tap Install to finish.',
      },
      {
        step: 'Manual Method (Via Phone Settings)',
        detail: 'Phone Settings → Apps & Notifications → Special App Access → "Install unknown apps" → select Chrome (or your browser) → Toggle ON.',
      },
    ],
    proTip: 'You only need to grant this permission once per browser. Subsequent SBG MUSIC updates will install seamlessly.',
  },
  {
    id: 'storage_permission',
    category: 'permissions',
    badge: 'Files & Media',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    question: 'How to manually grant "Files and Media" permissions if downloading fails?',
    summary: 'If offline song downloads or APK downloads fail, get stuck at 0%, or show "Permission Denied", Android may have blocked storage write access.',
    solutionSteps: [
      {
        step: '1. Open Android System Settings',
        detail: 'Open your phone\'s main "Settings" app from the home screen, app drawer, or swipe-down notification shade gear icon.',
        highlight: 'Settings → Apps (or App Management / Installed Apps)',
      },
      {
        step: '2. Find and Select SBG MUSIC',
        detail: 'Scroll through the applications list or use the search bar at the top to search for',
        highlight: '"SBG MUSIC" (or com.sbg.music)',
      },
      {
        step: '3. Open "Permissions"',
        detail: 'On the App Info page, tap on the section labeled',
        highlight: '"Permissions" (or "App Permissions")',
      },
      {
        step: '4. Grant "Files and Media" (or "Music and Audio")',
        detail: 'Look under the "Denied" or "Not Allowed" section. Tap on "Files and Media" (on Android 11–12), "Music and Audio" (on Android 13, 14, 15), or "Storage" (on Android 10 and older). Select:',
        highlight: '"Allow access to media only" (or "Allow all files")',
      },
      {
        step: '5. Enable "Allow Background Activity" (Recommended)',
        detail: 'Under App Info → Battery (or App Battery Usage), select "Unrestricted" so offline downloads continue downloading in the background when the screen is locked.',
      },
      {
        step: '6. Return to SBG MUSIC and Retry',
        detail: 'Switch back to SBG MUSIC. Tap download on any song or in your Offline Storage section. The track will immediately download into local persistent device storage.',
      },
    ],
    proTip: 'On Android 13, 14, and 15, Google separated storage into granular permissions. Granting "Music and Audio" gives SBG MUSIC direct access to store offline audio without exposing your photos, camera, or personal documents.',
  },
  {
    id: 'chrome_harmful',
    category: 'permissions',
    badge: 'Chrome Advisory',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    question: 'Why does Google Chrome say "File might be harmful"?',
    summary: 'This is a standard security disclaimer displayed by Google Chrome for ANY .apk file downloaded from the web, regardless of whether it comes from a verified developer.',
    solutionSteps: [
      {
        step: '1. Tap "Download anyway"',
        detail: 'On the Chrome bottom bar warning, tap',
        highlight: '"Download anyway"',
      },
      {
        step: '2. Verify Cryptographic SHA-256',
        detail: 'You can verify the file\'s authenticity against the official SHA-256 cryptographic hash published on this page below.',
      },
    ],
    proTip: 'SBG MUSIC is completely free, contains zero malware, and does not request invasive permissions.',
  },
];

export default function InstallFaqSection() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    play_protect: true, // Default open the most common issue
    parse_error: false,
    not_installed: false,
    permissions: false,
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'play_protect' | 'parse_error' | 'not_installed' | 'permissions'>('all');

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredItems = FAQ_ITEMS.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.category === activeFilter;
  });

  return (
    <section className="bg-[#111116] border border-white/10 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl relative overflow-hidden">
      {/* Decorative ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
            <HelpCircle size={14} className="text-purple-400" />
            <span>Troubleshooting & Installation Help</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Installation Questions (FAQ)
          </h2>
          <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-2xl leading-relaxed">
            Step-by-step guides to resolve common Android installation hurdles including Play Protect advisories, Parse errors, and Unknown Sources permissions.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto bg-black/40 p-1 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            All Questions ({FAQ_ITEMS.length})
          </button>
          <button
            onClick={() => setActiveFilter('play_protect')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'play_protect'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Play Protect
          </button>
          <button
            onClick={() => setActiveFilter('parse_error')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'parse_error'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Parse Error
          </button>
          <button
            onClick={() => setActiveFilter('not_installed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'not_installed'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Not Installed
          </button>
          <button
            onClick={() => setActiveFilter('permissions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'permissions'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Permissions & Media
          </button>
        </div>
      </div>

      {/* Accordion Questions List */}
      <div className="space-y-4 relative z-10">
        {filteredItems.map((item) => {
          const isOpen = Boolean(openItems[item.id]);

          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen 
                  ? 'bg-white/[0.04] border-purple-500/40 shadow-xl' 
                  : 'bg-white/[0.01] hover:bg-white/[0.03] border-white/5 hover:border-white/10'
              }`}
            >
              {/* Question Header Accordion Trigger */}
              <button
                onClick={() => toggleItem(item.id)}
                className="w-full p-5 text-left flex items-start justify-between gap-4 cursor-pointer"
                aria-expanded={isOpen}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono uppercase tracking-wider ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <span className="text-white/40 text-xs font-medium">Issue Guide</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    {item.question}
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed pr-2">
                    {item.summary}
                  </p>
                </div>

                <div className={`p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 transition-transform shrink-0 ${isOpen ? 'rotate-180 bg-purple-600/20 text-purple-300 border-purple-500/30' : ''}`}>
                  <ChevronDown size={18} />
                </div>
              </button>

              {/* Expandable Solution Content */}
              {isOpen && (
                <div className="px-5 pb-6 pt-2 border-t border-white/5 space-y-5 animate-fadeIn">
                  {/* Step-by-Step Instructions */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">
                      Recommended Safe Solution Steps:
                    </span>

                    <div className="grid grid-cols-1 gap-2.5">
                      {item.solutionSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex items-start gap-3"
                        >
                          <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/30">
                            {idx + 1}
                          </div>
                          <div className="text-xs sm:text-sm text-white/80 leading-relaxed flex-1">
                            <span className="font-bold text-white block mb-0.5">{step.step}</span>
                            <span>{step.detail} </span>
                            {step.highlight && (
                              <span className="font-bold text-yellow-300 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 font-mono text-xs inline-block mt-0.5">
                                {step.highlight}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pro Tip Callout Box */}
                  {item.proTip && (
                    <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 flex items-start gap-2.5 text-xs text-purple-200">
                      <ShieldCheck size={16} className="text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Security Guarantee: </strong>
                        <span>{item.proTip}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Still need help footer callout */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Need Additional Android Assistance?</h4>
            <p className="text-xs text-white/50">
              Download through the QR code above or verify the cryptographic SHA-256 signature below.
            </p>
          </div>
        </div>

        <a
          href="#checksum-section"
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10 shrink-0"
        >
          View SHA-256 Hash
        </a>
      </div>
    </section>
  );
}
