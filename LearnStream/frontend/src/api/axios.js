// This used to be its own axios instance with its own copy of the
// bearer-attach + single-flight-refresh interceptor logic, independently
// from lib/api/privateClient.js's copy of the same thing. The two drifted:
// this one never attached a bearer token automatically (every legacy Pages/
// component had to pass `Authorization: Bearer ${auth?.accessToken}` by
// hand) and its refresh success path went through a bespoke
// `registerAuthUpdater` callback into AuthProvider instead of the shared
// tokenStore, which is one of the reasons a fresh login/refresh could leave
// AuthProvider's `status` out of sync with reality.
//
// There is only one authenticated client now. This file is kept only
// because most legacy Pages/components still `import axios from
// "../api/axios"` — re-exporting privateClient here means they get the
// fixed, single implementation with no per-file changes required.
export { privateClient as default } from "../lib/api/privateClient";
