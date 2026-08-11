# More reference screenshots + WCAG AA

Captured for `cross-platform-ui-system` (More destination only).

## Screenshots

| Platform | Light | Dark |
|----------|-------|------|
| Web (token preview) | [web-more-light-dark.png](web-more-light-dark.png) (both) | same file |
| Android | [android-more-light.png](android-more-light.png) | [android-more-dark.png](android-more-dark.png) |
| iOS | [ios-more-light.png](ios-more-light.png) | [ios-more-dark.png](ios-more-dark.png) |

Web preview source: [more-reference-preview.html](../more-reference-preview.html) (uses the same color roles as `tokens.json`).

## WCAG AA contrast (More text-on-surface pairings)

Automated by `design-tokens/contrast.test.mjs`. Ratios (sRGB relative luminance):

| Pairing | Light | Dark | Required |
|---------|------:|-----:|----------|
| textPrimary on surface | 14.78 | 15.16 | ≥ 4.5 |
| textSecondary on surface | 5.22 | 7.37 | ≥ 4.5 |
| textPrimary on surfaceRaised | (tested) | (tested) | ≥ 4.5 |
| textSecondary on surfaceRaised | (tested) | (tested) | ≥ 4.5 |
| danger on surface / surfaceRaised | 6.10 / … | 6.35 / … | ≥ 4.5 |
| accent on surface (icon) | 5.61 | 7.32 | ≥ 3.0 |

All pairings pass AA for the More reference screen. Later destinations must re-run this check independently (see `ui-system-destination-adoption`).
