// The app's name in one place; index.html and public/manifest.json repeat it statically.
export const BRAND_NAME = 'Angaara';
// With ™, for the few places the name is shown as the brand itself (logo, title, About).
export const BRAND_MARK = `${BRAND_NAME}™`;
export const DEVICE_DISPLAY_NAME = `${BRAND_NAME} Web`;
// Where "Support Angaara" sends people. Empty keeps the button inactive until a link is set.
export const SUPPORT_URL = '';
export const TERMS_URL = `${import.meta.env.BASE_URL}terms.html`;
export const HOMEPAGE_URL = 'https://home.angaara.app';
// Separate site (Angaara-dev/security-docs), so it keeps its own address if the app moves.
export const SECURITY_URL = 'https://security.angaara.app';
// Supporter site; it only opens from the app, with a one-use ticket.
export const SUPPORTERS_URL = 'https://supporters.angaara.app';
export const SOURCE_URL = 'https://github.com/Angaara-dev/Angaara';
