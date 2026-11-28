/**
 * Raises Gradle's JVM memory for local builds. Firebase + the widget library push the
 * Kotlin compile past the template's 512 MB Metaspace (OutOfMemoryError: Metaspace).
 */
const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1536m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'));
    cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    return cfg;
  });
};
