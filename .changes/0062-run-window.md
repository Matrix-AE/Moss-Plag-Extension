---
train: packages
bump: patch
security: false
approval: standard
---

Fix the panel going blank after choosing a file. Chrome destroys a toolbar popup as soon as the OS file chooser takes focus, so file work now happens in a dedicated run window that the popup opens; every surface is also wrapped in an error boundary so a render failure explains itself instead of showing an empty panel. The run window is redesigned as three plain steps (language, files, review and start) with a Start button both above the steps and directly under the consent boxes, Pair Check tiles that show the chosen file name and swap in place when picked again, and no separate language confirmation — choosing the language is the confirmation.
