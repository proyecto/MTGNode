const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  // Variables de entorno (configúralas en tu CI/local):
  const appleApiKey = process.env.APPLE_API_KEY;           // ruta al .p8, p.ej. /Users/you/AuthKey_XXXXXX.p8
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;      // XXXXXX
  const appleApiIssuer = process.env.APPLE_API_ISSUER;     // UUID del issuer

  if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
    console.warn('Notarización omitida (faltan credenciales APPLE API).');
    return;
  }

  await notarize({
    appBundleId: 'com.tuempresa.tuapp',
    appPath,
    appleApiKey,
    appleApiKeyId,
    appleApiIssuer
  });
};
