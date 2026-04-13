<div align="center">

# 🎮 Tank Defense

### Defend the line. Survive the waves. Conquer the bosses.

*A fast-paced 2D tank defense game built with pure vanilla JavaScript and HTML5 Canvas.*

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Canvas API](https://img.shields.io/badge/Canvas_API-FF6B35?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

## 🚀 Features

### 🎯 Gameplay
- **3 Enemy Types** — Tanks, Helicopters, and massive Bosses, each with unique behavior
- **Progressive Difficulty** — Enemies grow stronger as levels increase
- **Defense Line** — A red boundary near the bottom; let enemies cross it and it's game over
- **Boss Encounters** — A powerful Boss with triple barrels appears every 5 levels (level 5, 10, 15, …)
- **High Score** — Personal best saved automatically via `localStorage`

### 🎨 Visuals
- **4 Player Color Schemes** — Military Green → Desert Tan → Steel Blue → Elite Black/Gold
- **Particle System** — Fire, smoke explosions, and hit spark effects on every impact
- **Twinkling Starfield** — Dynamic animated background
- **Glassmorphism HUD** — Semi-transparent Score / Level / Record panel
- **Shimmer & Glow Animations** — CSS-powered UI polish throughout

### ⚙️ Technical
- **Zero Dependencies** — Pure vanilla JS, HTML5 Canvas, and CSS — no frameworks, no build tools
- **Canvas 2D Rendering** — Full game loop with `requestAnimationFrame`
- **Collision Detection** — Per-entity bounding-box hit testing
- **Responsive Overlays** — Start screen, Game Over screen, and Level-Up notification built in HTML/CSS
- **LocalStorage Persistence** — High score survives browser refreshes
- **800 × 600 Canvas** — Fixed resolution for consistent gameplay

---

## 🕹️ How to Play

### Controls

| Action | Key(s) |
|---|---|
| Move Left | `←` Arrow Left &nbsp;/&nbsp; `A` |
| Move Right | `→` Arrow Right &nbsp;/&nbsp; `D` |
| Fire | `Space` |

### Gameplay Tips
- 🛡️ **Don't let enemies cross the red line** — that ends the game instantly.
- 🎯 **Prioritize Bosses** — they have high HP and reach the line quickly.
- 🚁 **Watch out for Helicopters** — they oscillate horizontally, making them harder to hit.
- ⬆️ **Level up fast** — upgrades unlock at levels 3, 5, and 7, significantly boosting your firepower.
- 🔥 **Keep moving** — staying still makes you an easy target for incoming fire.

---

## 📦 Getting Started

### ⚡ Quick Start

No installation required! Simply **open `index.html`** in any modern browser:

```
Double-click index.html  →  Game launches immediately
```

### 🔁 Clone & Play

```bash
# 1. Clone the repository
git clone https://github.com/IdHossein/Tank-game-Html5.git

# 2. Enter the project directory
cd Tank-game-Html5

# 3. Open in your browser
#    macOS
open index.html
#    Linux
xdg-open index.html
#    Windows
start index.html
```

> ✅ Works in any modern browser (Chrome, Firefox, Edge, Safari). No server needed — it's 100% static.

---

## 🏗️ Project Structure

```
Tank-game-Html5/
├── index.html   # Game shell: HUD, start/game-over overlays, canvas element
├── style.css    # Dark glassmorphism theme, shimmer animations, responsive layout
└── game.js      # Complete game engine: rendering, physics, AI, particle system
```

---

## 📊 Level Progression

| Level | Score Threshold | New Enemy Type | Player Upgrade |
|:-----:|:--------------:|----------------|----------------|
| 1 | 0 | 🔴 Tank | Basic tank |
| 2 | 300 | 🔵 Helicopter | — |
| 3 | 800 | 🔵 Helicopter | Side armor added |
| 4 | 1,600 | 🔵 Helicopter | — |
| 5 | 2,700 | 👾 **Boss** | Double barrel + shield emitters + glow |
| 6 | 4,200 | 👾 **Boss** | — |
| 7 | 6,500 | 👾 **Boss** | Triple barrel + Elite Black/Gold scheme |
| 8 | 9,500 | 👾 **Boss** | — |
| 9 | 13,500 | 👾 **Boss** | — |
| 10 | 18,500 | 👾 **Boss** | — |
| 11+ | +6,000/level | 👾 **Boss** | — |

> Bosses appear starting at level 5 and recur every 5 levels thereafter.

---

## 🤝 Contributing

Contributions, ideas, and bug reports are welcome! Here's how to get involved:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** the branch: `git push origin feature/amazing-feature`
5. **Open a Pull Request** — describe what you changed and why

Feel free to open an [issue](https://github.com/IdHossein/Tank-game-Html5/issues) for bugs, suggestions, or questions.

---

## 📄 License

This project is licensed under the **MIT License** — you are free to use, modify, and distribute it.  
See the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ by [IdHossein](https://github.com/IdHossein)

</div>
