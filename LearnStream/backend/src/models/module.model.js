// Re-export shim (D1, docs/contracts/domain-model.md): the `Modules` model is
// gone, replaced by `Sections` bound to the same underlying `modules`
// collection (see section.model.js). This file exists only so any code that
// still does `import { Modules } from "../models/module.model.js"` keeps
// working during the Wave 0-3 transition. W4 deletes this file and every
// remaining `Modules` import along with it.
import { Sections } from "./section.model.js";

export const Modules = Sections;
