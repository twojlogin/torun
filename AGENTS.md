# Architecture rules
- Route unsolicited private service messages and notices into Status; explicit service queries remain available to avoid automatic window clutter.
- Keep IRC responsive sizing shared across themes in global client classes; this prevents different themes from changing panel geometry.
- Below the laptop breakpoint, conversation and participant panels overlay the log and are mutually exclusive; this preserves message space.
- Keep modal overlays above the fixed page header; settings must remain unobstructed at every screen size.
