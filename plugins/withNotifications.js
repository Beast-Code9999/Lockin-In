/**
 * Android notifications without an extra dependency (SPEC §13):
 *   • creates the four notification channels in MainApplication.onCreate
 *     (channels must exist before FCM can post into them while the app is closed);
 *   • ships the white status-bar padlock as @drawable/notification_icon and makes it
 *     FCM's default icon.
 * Channel names show up in Android's notification settings, so they follow the
 * discretion rules too (tests/discretion.test.ts scans plugins/).
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');

const ICON_SOURCE = 'assets/images/notification-icon.png';
const ICON_NAME = 'notification_icon';

// [id, name, description, importance] — ids match notification_outbox.channel.
const CHANNELS = [
  ['reminders', 'Reminders', 'Your daily check-in nudges', 'IMPORTANCE_DEFAULT'],
  ['group', 'Crew activity', 'What your crew is up to', 'IMPORTANCE_DEFAULT'],
  ['boxes', 'Mystery boxes', 'Boxes, reveals and votes', 'IMPORTANCE_HIGH'],
  ['sos', 'Backup requests', 'When a mate needs backup right now', 'IMPORTANCE_HIGH'],
];

const MARKER = '// lockinin:notification-channels';

function channelCode() {
  const lines = CHANNELS.map(
    ([id, name, desc, importance]) =>
      `      android.app.NotificationChannel("${id}", "${name}", android.app.NotificationManager.${importance}).apply { description = "${desc}" },`,
  );
  return [
    `    ${MARKER}`,
    '    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {',
    '      getSystemService(android.app.NotificationManager::class.java)?.createNotificationChannels(listOf(',
    ...lines,
    '      ))',
    '    }',
  ].join('\n');
}

const withChannels = (config) =>
  withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') throw new Error('withNotifications expects a Kotlin MainApplication');
    let src = cfg.modResults.contents;
    if (!src.includes(MARKER)) {
      src = src.replace(/(override fun onCreate\(\) \{\s*\n\s*super\.onCreate\(\)\n)/, `$1${channelCode()}\n`);
      if (!src.includes(MARKER)) throw new Error('withNotifications: could not find super.onCreate() in MainApplication.kt');
    }
    cfg.modResults.contents = src;
    return cfg;
  });

const withIcon = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/drawable-xxxhdpi');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(cfg.modRequest.projectRoot, ICON_SOURCE), path.join(dir, `${ICON_NAME}.png`));
      return cfg;
    },
  ]);

const withDefaultIcon = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      'com.google.firebase.messaging.default_notification_icon',
      `@drawable/${ICON_NAME}`,
      'resource',
    );
    return cfg;
  });

module.exports = function withNotifications(config) {
  return withDefaultIcon(withIcon(withChannels(config)));
};
