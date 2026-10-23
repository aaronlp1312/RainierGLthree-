# Rainier changelog

## 2.1.0
- Orion: nine real stars (Betelgeuse, Rigel, Bellatrix, the belt, Saiph, Meissa, Hatysa) at their true RA/Dec in the sky shader, drawn with the same point size and falloff as the field stars so it blends in (CFG.orion.on). Only Rigel and Betelgeuse are a little bigger/tinted, like the field's own big stars. It is only up when Orion really is above the horizon.
- Moon: loads assets/moon1.png (then assets/moon.png) and maps it onto the lit sphere so phases still work; procedural moon is the fallback. CFG.moonDisc if the disc does not fill the image (auto-measured when the browser can read pixels).
- Birds: gull flocks (js/life.js) on #rainier-birds, between the clouds and the water. Daytime, thin out in storms, rain, fog and gales.
- Wind: blowing leaves and dust motes (js/life.js) on #rainier-wind, in front of the near layers. Counts and speed follow wind speed and direction, fade in rain, dim with the sky. Autumn palette Sep-Nov.
- Precip/fog: fog slider (state.fogManual); preset buttons Clear, Mist, Rain, Sleet, Snow, Hail, Fog set the whole spectrum in one tap. Fog also fades the far and near PNG groups (--fog).
- Anchors: every layer has an align edge (Rainier right, horizon/farground/foreground left, bridge and trees right) and a src list that tries the repo filenames first (rainiertw, horizontw, fargroundtw, foregroundtw, tree1l, tree3l, trunk2), then the old asset names, then the procedural layer. Procedural layers use ax to sit in the same place.
- Scroll: swiping through the 24 hours now sweeps the scene sideways too (CFG.scrollPan degrees at +-24h) so the anchored layers move. Two-finger pan still works on top (state.panAz).
- Trees sway with the wind (sway per layer).
- Graphics: cloud resolution 0.5 to 0.7, procedural stage 0.5 to 0.75.

## 2.0.2
- Stage: when a PNG in CFG.plx is missing, parallax.js now swaps in a procedural canvas layer (js/stage.js) instead of dropping it, so the Narrows scene is always on screen: Rainier, horizon ridges, forested banks, the suspension bridge, driftwood on a gravel beach, and the cliff. Same depth k, pan limits, night dimming and lightning flash as the PNGs. A PNG that loads always wins. CFG.stageFallback (true) turns the fallback off, CFG.stageRes (0.5) sets its resolution.
- Fix: the precip slider never worked. Its id (rainier-precip) was also the precip canvas id, so controls.js bound the canvas. Slider is now rainier-precip-amt.
- build.py rebuilds dist/rainier.bundle.js from js/ with no npm (python3 build.py).

## 2.0.1
- API key loads from the device file /storage/emulated/0/weatherapi (CFG.keyFiles), any layout, it finds the 32 character key. Falls back to a copy next to the page, then the last key it saw. %OWM_KEY% injection still wins if Tasker fills it.
- Status line in the panel: key source, OWM result or error, icon, mm, rain and fog levels, so problems show on screen.
- Rain no longer vanishes when the icon says rain but OWM reports a tiny mm value.

## 2.0.0
- Sky view widened (SKY_Z in config.js): the sky now shows about 0 to 42 degrees above the horizon, so the noon sun and the moon are in frame. Water view is unchanged.
- Stars: bigger, brighter, more of them; a few bright ones.
- Sun and moon disc sizes retuned (sunDeg 3.5, moonDeg 4.0).
- Parallax PNG stack: far group (peak, horizon) sits behind the clouds, near group (shore, bridge, driftwood, cliff) sits in front of water and weather. Layers are listed in CFG.plx and any missing PNG is skipped. Depth k per layer, night lighting follows the sky, flashes with lightning.
- Pan is clamped (CFG.panLimit degrees) so the PNG edges never show.
- Fog and haze layer in the precip canvas (fog icon, plus haze with rain).
- Long-press (0.7s) on the scene toggles the debug panel. CFG.ui.startHidden hides it at launch.
- Version shown in the panel, tab title and file headers.

## 1.4.0
- Precip spectrum (mist to downpour, rain to snow, hail) in one canvas: js/precip.js.
- Lightning: bolt, cloud flash, delayed scene shake: js/lightning.js.
- Stage wrapper (#rainier-stage) so the shake moves every layer.
- Debug: precip and temp sliders, Zap button.

## 1.3.0
- Time travel swipe: +24h forecast and -24h history, inertia, return home, double-tap home.
- js/weather.js and js/timeline.js.

## 1.2.0
- Cloud canvas: cirrus plus volumetric deck, storm darkness inside the clouds.

## 1.1.0
- 24 hourly sky gradients as CSS variables, sunrise and sunset driven.
- Modular split: config, astro, shaders, sky-gradient, river, scene, controls, main.

## 1.0.0
- River water shader on three r185 with Timer, sky, sun, moon, procedural stars and Milky Way.
