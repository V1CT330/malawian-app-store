# Account colors, working app actions, and cleaner developer settings

## What will change

- Add an **Accent color** section to Account settings with a full color picker plus useful presets such as green, blue, red, orange, purple, and black. Save the choice on the device and apply it consistently across both shopping and Developer Mode, while preserving light/dark theme support.
- Make store search reliable across product names, descriptions, developer names, categories, and product type. Show a clear search state and allow the existing search bar to work when entered from other pages.
- Add real installed-app state rather than inferring installs from download history. Installed apps will support **Open**, **Update** when a newer published version exists, and **Uninstall**. History remains historical and uninstalling will not erase it.
- Update each app page so its main action reflects its state: Install, Open, or Update. Website visits remain Open website and do not pretend to install software.
- Simplify Developer settings so each concern has one home: Account settings owns personal profile, theme, accent color, mode switching, and sign-out; Developer settings links to its dedicated Store listing, Verification, Subscription, and Security pages without repeating their controls.
- Remove repeated page headings inside the Developer console where the console header already provides the same title.

## Data and safety

- Add a private per-user installed-app table with explicit grants and owner-only access rules.
- Keep installation analytics/history append-only and separate from current installed state.
- No changes to payment, Didit, WhatsApp verification, publishing logic, routes, or existing product data.

## Verification

- Check color selection and persistence in light and dark themes.
- Test search from the store and from another page.
- Test install → open → update → uninstall with signed-in app state.
- Check Account and Developer settings on mobile and desktop, and confirm the project builds without errors.
