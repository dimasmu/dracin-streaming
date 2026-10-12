/**
 * PrimeNG 22 verifies a PrimeUI license at bootstrap. Without a registered key
 * it reports the "unconfigured" state and shows the "Invalid PrimeUI License"
 * banner, even for the free tier.
 *
 * The free Community License key is issued from https://primeui.dev/licenses/community.
 * Keep this key private: do not commit it to a public repository. For deployment,
 * inject it at build time (for example via a CI secret / file replacement) instead
 * of hard-coding it here.
 */
export const PRIMEUI_LICENSE_KEY =
  'eyJpZCI6IjE3ZDc2ZjllLTU2ZTItNDRmNC1iODFkLTE2MjI4Nzg4YzU3ZSIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3OTE3ODc2NzIsImV4cCI6MTgyMzMyMzY3Mn0.aewGDTnu9sHHSJL4dDdvuUnq-IqZuG017Y6LBcT5_6l_A49u2HRTijbbmIhxmG4Oloi0DGGLpV68Ody1HCsrBg';
