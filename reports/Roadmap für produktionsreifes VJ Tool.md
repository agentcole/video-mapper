# Renderer tauschen, Datenmodell öffnen, Showsicherheit liefern

Der Video-Mapper ist bei Commit cea802b ein brauchbarer Mapping-Editor für einen Operator in einem Fenster: Rechteck-, Kreis- und Polygon-Frames, 4-Punkt-Corner-Pin per CSS-`matrix3d`, feste Kompositionsauflösung, Layers-Panel, Undo/Redo und eine IndexedDB-Medienbibliothek funktionieren. Ein Live-Werkzeug ist er noch nicht. Es gibt kein separates Output-Fenster, kein MIDI/OSC, keine BPM- oder Audio-Reaktivität, keine Clips, Decks, Transitions oder Shader, und das Datenmodell mit **genau einem Medium pro Frame** blockiert Clip-Triggering grundsätzlich. Drei verifizierte Befunde wiegen am schwersten. **Blend-Modes sind zur Laufzeit wirkungslos.** Das in der TODO als „resolved" markierte **Corner-Pin-Problem besteht in neun konkreten Abweichungen fort.** Und eine **doppelte Service-Worker-Registrierung erzeugt blockierende `confirm()`-Dialoge**, was auf einem Projektor einen Showabbruch bedeutet. Die gute Nachricht ist, dass das gewählte Prinzip („die Form bleibt, der Inhalt wird innen per Homographie verzerrt") genau dem entspricht, was Millumin-Masken, LPMT, ofxPiMapper-Kreise und Photoshop tun. Es geht sogar über Resolume hinaus, dessen Polygon-Slices keine Perspektive kennen. Die Korrektur gelingt im bestehenden CSS-Renderer in wenigen Wochen. Danach führt kein Weg an einem GPU-Compositor (WebGPU mit WebGL2-Fallback) hinter einer Renderer-Abstraktion und an einem versionierten Szenenmodell mit Clips und Decks vorbei. Im Wettbewerb ist Mapping-Geometrie Commodity: MadMapper und HeavyM investieren seit 2024 in Show-Control, LED und KI statt in neue Warp-Modelle, und kein Browser-Tool verbindet Resolume-artiges Clip-VJing mit produktionsreifem Mapping. Empfohlen wird deshalb eine Chromium-first-PWA plus ein Electron-„Pro"-Build, eine sechsstufige Roadmap von der Stabilisierung (Phase 0) bis zu Differenzierern wie Web-Remote, Kollaboration und HAP (Phase 5), und eine Positionierung zwischen Open Source und Resolume Avenue (€299), die zuerst Einsteiger-VJs, Einstiegs-Mapping und Bildung adressiert.

## Ein solider Editor-Prototyp mit 5.265 Zeilen, dem die Live-Infrastruktur fehlt

Die Bestandsaufnahme beruht auf einem vollständigen Audit aller Dateien in `src/` (5.265 Zeilen), der Konfigurationen und der Git-Historie. Ergänzt wurde es durch einen TypeScript-Build, einen Vite-Build, Lint-Läufe, Laufzeitmessungen in Chrome gegen `vite preview` und ein Node-Skript, das die echte `geometry.ts` importiert. Das Gesamtbild ist ein **„Editor-Grade-Prototyp"**: Die meisten Funktionen arbeiten für einen einzelnen Operator in einem Fenster. Die Probleme ballen sich genau in dem Bereich, den der Nutzer selbst markiert hat (Corner-Pin über Formen hinweg), und beim Compositing (Blend-Modes).

### Was wirklich funktioniert und was nur so aussieht

Die folgende Tabelle fasst den verifizierten Stand zusammen. C steht für vollständig, P für teilweise, B für fehlerhaft.

| Bereich | Status | Befund | Beleg |
|---|---|---|---|
| Medientypen | C | Nur `video` und `image` | [types.ts:3](../src/types.ts) |
| Hintergrund (Farbe, Bild, Video) | C/P | Bild und Video nur aus der Bibliothek; Hintergrundvideo nicht von Play/Pause-All erfasst | [Canvas.tsx:1340-1364](../src/components/Canvas.tsx) |
| Formen | C | `rectangle`, `circle`, `polygon`; ein Dreieck ist ein Polygon mit drei Punkten | [types.ts:4](../src/types.ts) |
| Polygon zeichnen | **B** | Doppelklick-Abschluss fügt einen doppelten Vertex hinzu; ein Dreieck wurde zur Laufzeit als `[[0,1],[0.5,0],[1,1],[1,1]]` gespeichert | [Canvas.tsx:708-714](../src/components/Canvas.tsx), [Canvas.tsx:627-673](../src/components/Canvas.tsx) |
| Verschieben, Snap, Rotation | C | Gruppen-Drag, Rotation um das bbox-Zentrum | [Canvas.tsx:761-793](../src/components/Canvas.tsx), [Canvas.tsx:819-836](../src/components/Canvas.tsx) |
| Resize mit 8 Handles | P | Rotationsbewusst, min. 50 px, aber **nicht für Polygone** | [MediaFrame.tsx:640](../src/components/MediaFrame.tsx) |
| Corner-Pin | P | Vier Pixel-Offsets von den bbox-Ecken; Details im nächsten Abschnitt | [MediaFrame.tsx:182-194](../src/components/MediaFrame.tsx) |
| Polygon-Texturmodus `warp` | P/B | Nur bei exakt vier Vertices, sonst stiller Fallback auf `clip` | [MediaFrame.tsx:334-342](../src/components/MediaFrame.tsx), [MediaFrame.tsx:912-918](../src/components/MediaFrame.tsx) |
| Soft Edges | P | Vier lineare Gradientenmasken an den bbox-Kanten, ohne Gamma | [MediaFrame.tsx:397-430](../src/components/MediaFrame.tsx) |
| Testbilder | C | Pro Frame (mitverzerrt) und global | [TestCard.tsx:14-73](../src/components/TestCard.tsx) |
| Kompositionsauflösung | C/P | 720p–4K plus 320–8192 frei; eine Änderung skaliert die Frames **nicht** mit | [ControlPanel.tsx:59-66](../src/components/ControlPanel.tsx), [Canvas.tsx:1263](../src/components/Canvas.tsx) |
| Master-Fader und Blackout (B) | P | Nur Pixel; **Ton läuft im Blackout weiter**; nicht persistiert | [Canvas.tsx:1338](../src/components/Canvas.tsx), [Canvas.tsx:1497-1499](../src/components/Canvas.tsx) |
| Grid und Snap | C | 8–128 px, G/Shift+G, persistiert | [Canvas.tsx:216-219](../src/components/Canvas.tsx) |
| Layers-Panel | C/P | Numerisches W/H erlaubt ≥10 px und **skaliert die Pins nicht** | [LayersPanel.tsx:216-217](../src/components/LayersPanel.tsx) |
| Blend-Modes (16) | **B** | Visuell wirkungslos gegenüber anderen Layern (Laufzeit-Test) | [MediaFrame.tsx:488](../src/components/MediaFrame.tsx) |
| CSS-Filter, Flip, Zoom/Pan | C | Acht CSS-Filter | [MediaFrame.tsx:361-395](../src/components/MediaFrame.tsx) |
| Mehrfachauswahl, Marquee | C/P | Hit-Test nutzt die **unverzerrte** bbox | [Canvas.tsx:82-95](../src/components/Canvas.tsx) |
| Undo/Redo | C | 50 Schritte, 400 ms Debounce, ohne Grid und Auswahl | [Canvas.tsx:34-35](../src/components/Canvas.tsx), [Canvas.tsx:332-391](../src/components/Canvas.tsx) |
| Medienbibliothek | C/P | IndexedDB, 50 MB pro Datei und 500 MB gesamt; Löschen ohne Referenzprüfung | [mediaStorage.ts:8-9](../src/lib/mediaStorage.ts), [MediaLibrary.tsx:109-119](../src/components/MediaLibrary.tsx) |
| Projekt-Persistenz | C/P | Autosave in localStorage (1 s), Export JSON bzw. JSON plus Base64-Medien | [Canvas.tsx:321-327](../src/components/Canvas.tsx), [storage.ts:74-198](../src/lib/storage.ts) |
| Wiedergabe | P | Nur Play/Pause-All über einen 100-ms-„Puls"; kein Seek, kein Transport, kein Sync | [Canvas.tsx:224-235](../src/components/Canvas.tsx), [MediaFrame.tsx:222-290](../src/components/MediaFrame.tsx) |
| Präsentationsmodus | P | Gleiches Fenster und gleicher DOM, Vollbild auf dem Canvas | [Canvas.tsx:237-266](../src/components/Canvas.tsx) |
| Tastatur-Shortcuts | C | Alle im README genannten existieren | [Canvas.tsx:496-620](../src/components/Canvas.tsx) |
| Touch | P | Nur Pin- und Vertex-Handles; Drag, Resize, Rotate und Zeichnen sind maus-only | [MediaFrame.tsx:208-212](../src/components/MediaFrame.tsx), [Canvas.tsx:1048-1055](../src/components/Canvas.tsx) |

Hinter dieser Oberfläche liegt ein fragiles Zustandsmodell. Der gesamte Anwendungszustand steckt in `useState`-Hooks einer einzigen **1.541-Zeilen-Komponente `Canvas`**, ohne Store und mit Prop-Drilling ([Canvas.tsx:98-183](../src/components/Canvas.tsx)). Projekte liegen unter einem einzigen localStorage-Schlüssel. Die Versionskennung `'4.0.0'` wird geschrieben, aber nie gelesen, und „Migration" bedeutet nur, Default-Werte per `??` aufzufüllen ([storage.ts:3-4](../src/lib/storage.ts), [storage.ts:23-46](../src/lib/storage.ts)). Der Import prüft lediglich, ob `frames` ein Array ist ([storage.ts:165-198](../src/lib/storage.ts)). Der Autosave-Aufruf im Timer hat kein try/catch ([Canvas.tsx:321-327](../src/components/Canvas.tsx)), sodass ein Überschreiten der etwa 5 MB localStorage-Quote unbemerkt bleibt. Weder `navigator.storage.persist()` noch `estimate()` wird aufgerufen; der Browser darf die Medienbibliothek also unter Speicherdruck löschen, und Projekte laden dann mit leeren Frames. Der Export „mit Medien" baut einen einzigen Base64-JSON-String im Speicher. Nahe der 500-MB-Grenze überschreitet er voraussichtlich die maximale String-Länge von V8 ([mediaStorage.ts:285-342](../src/lib/mediaStorage.ts)). Es gibt nur einen Projekt-Slot, kein „Speichern unter", keine Szenen und keine Backups.

### Ein CSS-Renderer mit zehn harten Grenzen

Das Rendering ist reines DOM/CSS. Ein letterboxed skaliertes Stage-`div` enthält pro Frame einen absolut positionierten, rotierten Wrapper. Darin liegt ein inneres `div` mit `clip-path`-Polygon, und darin das Content-Element (`<video>`, `<img>` oder SVG) mit `matrix3d`-Homographie, CSS-`filter` und `mask-image` für Soft Edges ([MediaFrame.tsx:460-524](../src/components/MediaFrame.tsx)). Die Homographie-Mathematik in `geometry.ts` löst ein 8×8-Gleichungssystem per Gauß-Elimination und liefert `null`, wenn ein Pivot unter 1e-10 fällt. Eine Inverse gibt es nicht ([geometry.ts:11-34](../src/lib/geometry.ts), [geometry.ts:96-114](../src/lib/geometry.ts)).

Aus dieser Architektur folgen zehn harte Grenzen. Der Renderer kennt **nur projektive Abbildungen eines Rechtecks**, also weder Mesh-, Bezier- noch Grid-Warp; die TODO räumt das selbst ein ([TODO.md:16](../TODO.md)). Er kann keine Textur pro Dreieck oder Polygon abbilden und hat keine Shader außer der CSS-Filterliste. Blend-Modes können nur dann über Frames hinweg mischen, wenn der Wrapper selbst `mix-blend-mode` trägt. Soft Edges sind lineare Alpha-Rampen ohne Gamma- oder Schwarzwertkontrolle, wie sie echtes Projektor-Blending braucht. Die Resampling-Qualität starker Keystones steuert der Browser-Compositor. Nicht-konvexe Quads werden nicht verhindert, und `matrix3d` rendert dann gefaltete Geometrie ([MediaFrame.tsx:182-194](../src/components/MediaFrame.tsx)). **Jedes `<video>` dekodiert unabhängig**: Derselbe Clip auf N Flächen kostet N Decodes ohne gemeinsame Uhr ([MediaFrame.tsx:505-515](../src/components/MediaFrame.tsx)), und das README rät selbst zu „5–10 Videos" maximal ([README.md:209](../README.md)). Der Output ist das Editorfenster im Vollbild. Und jede visuelle Änderung läuft durch eine React-Reconciliation des ganzen Canvas statt durch eine Render-Schleife. Eine Suche nach `window.open`, `BroadcastChannel`, `getScreenDetails`, `getUserMedia`, `requestMIDIAccess`, `AudioContext`, `WebSocket`, WebGL, `captureStream`, `MediaRecorder` und `navigator.storage` ergab **null Treffer**.

### Build grün, Lint rot, null Tests

Der strikte TypeScript-Build läuft durch, und das Bundle ist mit **330 KB JS (102 KB gzip)** klein. `npm run lint` scheitert dagegen mit 14 Problemen (10 Fehler, 4 Warnungen). Alle liegen im generierten `dev-dist/`, das `globalIgnores(['dist'])` nicht abdeckt ([eslint.config.js:9](../eslint.config.js)); `eslint src` ist sauber. Die Commit-Nachricht „lint clean" stimmt also nur für `src`. Es gibt **keinen einzigen Test**, kein Test-Skript und keine Test-Abhängigkeit ([package.json:6-11](../package.json)). Zwei God-Components (Canvas 1.541 Zeilen, MediaFrame 1.193 Zeilen) mischen Viewport-Mathematik, Gesten, Tastatur, Historie, Persistenz und Render-Baum.

Die Performance-Risiken sind strukturell. Jede Mausbewegung beim Ziehen ruft `setFrames` auf und rendert alle Frames neu, es gibt **0 `React.memo`** und **0 `requestAnimationFrame`**. Window-Listener werden bei jeder Änderung von `frames` neu gebunden ([Canvas.tsx:853-857](../src/components/Canvas.tsx), [Canvas.tsx:1048-1055](../src/components/Canvas.tsx)), jeder Frame registriert vier eigene Window-Listener, und Blob-URLs werden nie freigegeben ([Canvas.tsx:1076](../src/components/Canvas.tsx), [Canvas.tsx:1115](../src/components/Canvas.tsx)). Barrierefreiheit fehlt: 0 `aria-*`, 0 `role=`, nur per Hover erreichbare Frame-Controls. Fehler werden über 8 `alert()`/`confirm()`-Aufrufe kommuniziert, eine ErrorBoundary gibt es nicht. Am kritischsten ist die PWA-Konfiguration. Das gebaute `index.html` enthält zwei Manifeste und registriert den Service Worker zweimal: einmal über das Plugin und einmal manuell in `main.tsx` mit `{type:'module'}` ([main.tsx:7-12](../src/main.tsx), [index.html:21](../index.html)). Im Laufzeittest erschien beim ersten Laden und erneut beim Reload ein **blockierender JS-Dialog**, der die Seite anhielt. Plausibelste Ursache ist `confirm('New version available. Reload to update?')` ([main.tsx:21](../src/main.tsx)). Hinzu kommen fehlende CSP, eine „Add from URL"-Eingabe ohne Scheme-Allowlist und `CacheFirst`-Caching opaker Video-Antworten ([vite.config.ts:44-57](../vite.config.ts)).

### Zwölf README-Aussagen halten dem Code nicht stand

| README-Aussage | Realität im Code | Beleg |
|---|---|---|
| „Media **and projects** persist … using IndexedDB" | Projekte liegen in localStorage unter einem Schlüssel; das README widerspricht sich in Zeile 188 selbst | [README.md:57](../README.md), [storage.ts:3](../src/lib/storage.ts) |
| „Background Sync" | Kein Plugin und kein Code; Workbox kennt nur Precache und Runtime-Caching | [README.md:59](../README.md), [vite.config.ts:30-59](../vite.config.ts) |
| „Resize using 8 directional handles" | Polygone haben keine Resize-Handles | [README.md:25](../README.md), [MediaFrame.tsx:640](../src/components/MediaFrame.tsx) |
| „Z-index layering control" im Hover-Panel | Nur Hoch/Runter-Buttons im Layers-Panel | [README.md:42](../README.md), [LayersPanel.tsx:172-187](../src/components/LayersPanel.tsx) |
| Corner-Pin „works on every shape … Photoshop-style" | Nur der Umriss läuft durch die Homographie; Vertex-Handles, Warp-Quads und Doppelklick-Dreiecke weichen ab | [README.md:162](../README.md), [TODO.md:8](../TODO.md) |
| Layers-Panel mit „opacity and blend mode" | Blend-Mode ist zur Laufzeit wirkungslos | [README.md:169](../README.md) |
| „optimized to minimize re-renders" | 0 `memo`, Inline-Closures pro Frame | [README.md:196-202](../README.md), [Canvas.tsx:1367-1384](../src/components/Canvas.tsx) |
| „Event Throttling" | Kein Throttle und kein rAF; `setFrames` pro Mausbewegung | [Canvas.tsx:853-857](../src/components/Canvas.tsx) |
| „Object URLs are properly managed" | Medien-Blob-URLs werden nie freigegeben | [mediaStorage.ts:249](../src/lib/mediaStorage.ts) |
| „React 18" | `react ^19.2.0` | [README.md:215](../README.md), [package.json:20-21](../package.json) |
| „Radix UI: Accessible component primitives" | Nur `react-slot` und `react-slider` in Gebrauch; 0 `aria-*` | [README.md:221](../README.md), [package.json:13-16](../package.json) |
| Projektstruktur mit `types/index.ts` | In cea802b gelöscht; LayersPanel, TestCard, MediaLibrary, BackgroundSettings und geometry.ts fehlen | [README.md:232-250](../README.md) |

Korrekt sind dagegen alle Tastenkürzel, das Verhalten von Komposition, Master und Blackout, der Undo-Umfang, das Grid, der Export mit Medien und die 50/500-MB-Grenzen.

## Neun Corner-Pin-Abweichungen gehen auf drei konkurrierende Verformungsmodelle zurück

Die unkommittierte Notiz oben in der TODO lautet sinngemäß: Bitte untersuchen, warum jeder Corner-Pin (Quadrat, Dreieck, Polygon …) anders behandelt wird; es soll wie in Photoshop funktionieren, die Form bleibt, wird aber innen verzerrt ([TODO.md:2](../TODO.md)). Dieselbe Datei führt den „Unified corner pin … for every shape" bereits als erledigt ([TODO.md:8](../TODO.md), [TODO.md:11-13](../TODO.md)). Beides stimmt halb. Das *Rendering* schickt seit cea802b den Umriss jeder Form durch dieselbe bbox-Homographie. Das *Verhalten* weicht aber je nach Form auf neun Arten ab.

| # | Abweichung | Ursache und Messwert | Beleg |
|---|---|---|---|
| 1 | Pins hängen an der Frame-bbox, nicht an der Form | Beim Dreieck (0.5,0),(1,1),(0,1) sitzen BR und BL auf Vertices, TL und TR schweben im Leeren | [geometry.ts:96-114](../src/lib/geometry.ts), [types.ts:9-16](../src/types.ts) |
| 2 | Unterschiedliche Handle-Sets | Rechteck/Kreis: 8 Resize-Handles plus 4 Pins; Polygon/Dreieck: Vertex-Handles plus 4 Pins, kein Resize | [MediaFrame.tsx:640-673](../src/components/MediaFrame.tsx) |
| 3 | Vertex-Handles ignorieren die Homographie | Handle bei (200,0), gerenderter Apex bei (209.3,30.4): **31,8 px daneben**; ein gezogener Vertex landet bei H(Zeiger) statt unter dem Cursor | [MediaFrame.tsx:658-659](../src/components/MediaFrame.tsx), [MediaFrame.tsx:166-179](../src/components/MediaFrame.tsx) |
| 4 | Warp-Quads nutzen eine zweite Abbildung | Im `warp`-Modus werden die Vertices zu zweiten Pins, abhängig von der Klickreihenfolge; gegen den Uhrzeigersinn ergibt sich Determinante −1 (gespiegelt), Start bei BR dreht um 180° | [MediaFrame.tsx:340](../src/components/MediaFrame.tsx) |
| 5 | Stiller Fallback | Dreiecke und n-Ecke im `warp`-Modus fallen ohne Hinweis auf `clip` zurück | [MediaFrame.tsx:912-918](../src/components/MediaFrame.tsx) |
| 6 | Degeneriertes Quad tötet den Content-Warp | Doppelklick-Dreieck = Quad [A,B,C,C] → `computeHomography` liefert `null` → `contentH` wird `null`, ohne Fallback; zur Laufzeit: verzerrter Umriss, unverzerrtes Testbild | [MediaFrame.tsx:336-342](../src/components/MediaFrame.tsx), [geometry.ts:23](../src/lib/geometry.ts) |
| 7 | Rechteckige Overlays | Soft Edge, Auswahlrahmen und Dateinamen-Leiste folgen nur den bbox-Kanten | [MediaFrame.tsx:397-406](../src/components/MediaFrame.tsx), [MediaFrame.tsx:575-584](../src/components/MediaFrame.tsx) |
| 8 | 4-px-Editorrahmen verschiebt den Inhalt | Content misst 316×262 in einem 324×270-Wrapper; TR-Ecke des Inhalts bei (367,3; 24,4), Pin-Handle bei (370,0; 20,0). Im Präsentationsmodus korrekt | [MediaFrame.tsx:485](../src/components/MediaFrame.tsx), [index.css:5-7](../src/index.css) |
| 9 | Numerisches Resize skaliert Pins nicht | Handle-Resize skaliert die Offsets, das Layers-Panel nicht | [LayersPanel.tsx:216-217](../src/components/LayersPanel.tsx), [Canvas.tsx:933-945](../src/components/Canvas.tsx) |

Dazu kommen zwei Randeffekte: Ein Kreis wechselt bei aktivem Pin von exaktem `ellipse()` zu einem 48-Eck, auch bei Null-Offsets ([MediaFrame.tsx:345-357](../src/components/MediaFrame.tsx)), und die bbox eines Polygons wird nach Vertex-Edits nie neu angepasst, weil die Vertices auf [0,1] geklemmt sind ([MediaFrame.tsx:173-174](../src/components/MediaFrame.tsx)). Die **Grundursache** ist, dass drei Verformungsmodelle ohne gemeinsame Wahrheit nebeneinander existieren: Frame-Pins im bbox-Raum, Polygon-Vertices im unverzerrten normalisierten Raum und der `warp`-Texturmodus, in dem die Vertices selbst zu Pins werden. Die UI berechnet Handle-Positionen zudem in verschiedenen Räumen, Pins verzerrt und Vertices unverzerrt.

### Die Konkurrenz löst Perspektive auf Nicht-Vierecken mit drei Mustern

Drei Punktpaare definieren nur eine affine Abbildung; eine Homographie braucht vier. Professionelle Werkzeuge folgen deshalb einem von drei Mustern. **Muster A** bildet Texturen pro Vertex ab: Dreiecke exakt affin, Polygone trianguliert und stückweise affin, ohne Perspektive. So arbeiten Resolume-Poly-Slices, MapMap, ofxPiMapper-Dreiecke und Millumin-Dreieck-Slices. Resolume dokumentiert ausdrücklich, dass „Poly slices cannot be perspective warped" und Bezier-Warping dort fehlt ([Resolume Output Transformation](https://resolume.com/article/52)). Forennutzer beklagen die fehlende Perspektive auf Polygonen seit Jahren ([Resolume forum p=93004](https://resolume.com/forum/viewtopic.php?p=93004)), und Staff erklärt, dass einzelne Punkte Knicke erzeugen und nur die vier Perspektivpunkte gleichmäßig verzerren ([Resolume forum p=53475](https://www.resolume.com/forum/viewtopic.php?p=53475)). MapMap bildet Quads nicht projektiv ab, sondern unterteilt rekursiv, was gegen eine **bilineare** Abbildung konvergiert; das Issue zur perspektivisch falschen Ellipsenmitte ist noch offen ([MapMap issue #177](https://github.com/mapmapteam/mapmap/issues/177)). ofxPiMapper zeichnet Quads ohne Perspektivmodus als zwei Dreiecke, was Nutzer als „massive distortion line" beschreiben ([ofxPiMapper issue #22](https://github.com/kr15h/ofxPiMapper/issues/22)).

**Muster B** legt die Form in einen 4-Ecken-Container. Die Maske bleibt im Content-Raum und wandert durch die Homographie des Containers, wie Photoshops Distort/Perspective am Begrenzungsrahmen ([Adobe Photoshop: modify images](https://helpx.adobe.com/photoshop/web/edit-images/transform-and-crop/modify-images.html)). ofxPiMapper rendert Kreise als Quad mit Kreismaske ([CircleSurface.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/CircleSurface.cpp)), LPMT zeichnet Polygonmasken innerhalb der `findHomography`-Transformation ([LPMT quad.cpp](https://github.com/hvfrancesco/lpmt/blob/master/src/quad.cpp)), und bei Millumin gilt „Masking is processed before mapping" ([Millumin forum](https://forum.millumin.com/discussion/comment/1341/)). Am explizitesten ist MadMapper: Seit 4.0 lassen sich Masken **an das Quad, an den Input oder an nichts** hängen, folgen also dem Warp, der Textur oder bleiben fest im Output-Raum ([GarageCube forum 4.0](https://forum.garagecube.com/viewtopic.php?f=20&t=35230)). **Muster C** verzichtet auf Textur-Warp: HeavyM-„Faces" sind Vektorumrisse mit generativen Effekten, deren verschiebbares „Center +" als Fluchtpunkt eine Perspektive nur vortäuscht ([HeavyM help: Center and perspective](https://help.heavym.net/hc/en-us/articles/4404439496850-Using-the-Center-to-control-the-perspective-of-effects)).

Nur Muster B liefert echte Perspektive auf Nicht-Vierecken. Daraus folgt eine wichtige Neubewertung: **Das aktuelle „Unified Warp"-Modell ist bereits die Profi-Antwort.** Es ist nur inkonsistent umgesetzt. Ein Dreieck sollte nie über seine drei Vertices verzerrt werden, weil drei Punkte keine Perspektive ausdrücken können. Der Begrenzungsquad bleibt für jede Form das Warp-Handle-Set, und das Bearbeiten der Vertices wird ein getrennter „Form bearbeiten"-Modus im Content-Raum. Photoshop trennt Free Transform und Direktauswahl auf dieselbe Weise.

### Kurzfristig: eine Photoshop-Hülle im bestehenden CSS-Renderer

Die Korrektur passt vollständig in den heutigen Renderer. Pro Frame bleibt **eine Homographie H**, definiert durch vier Pins am achsenparallelen Begrenzungsrahmen. Nach jedem Vertex-Edit wird dieser Rahmen neu an die Vertices angepasst; die Vertices werden renormalisiert und x/y/w/h so korrigiert, dass absolute Positionen unverändert bleiben. *Alles* läuft durch H: Content-Ecken, Form-Vertices, Vertex-Handles, Warp-Grid, Auswahlumriss (der CSS-Rahmen wird durch den verzerrten SVG-Umriss ersetzt) sowie Hit-Test und Marquee über H(bbox). Neu hinzu kommt eine `invertHomography`-Funktion (3×3-Inverse). Beim Ziehen eines Vertex wird der Zeiger mit H⁻¹ zurückgerechnet, damit der Vertex unter dem Cursor bleibt. Polygone erhalten dieselben acht Resize-Handles, normalisierte Vertices skalieren dann automatisch mit. Der numerische W/H-Pfad nutzt dieselbe Pin-Skalierung wie die Handles, und der 4-px-Rahmen verschwindet aus der Content-Box und wird zum Overlay, damit Editor und Output pixelgleich sind.

Der `warp`-Modus braucht eine Entscheidung. Entweder entfällt er, weil er dem Platzieren der Pins auf den Quad-Vertices entspricht, oder er wird zu einer expliziten Aktion „An Vertices pinnen", die die vier Vertices in `perspectiveCorners` kopiert und die Vertices auf das Einheitsquadrat zurücksetzt. Bleibt er, wird die Vertex-Reihenfolge per vorzeichenbehafteter Fläche kanonisiert, und bei `null` aus `computeHomography` greift der Fallback auf die bbox-Homographie. Zwei weitere Absicherungen kommen hinzu: Der Polygon-Abschluss ignoriert Mousedowns mit `e.detail >= 2` und entfernt aufeinanderfolgende Duplikate innerhalb eines ε ([Canvas.tsx:699-714](../src/components/Canvas.tsx)). Und Pin-Drags, die das Quad nicht-konvex machen, werden abgelehnt; WATCHOUT erzwingt beim Corner-Pin ebenfalls ein konvexes Quad ([WATCHOUT Corner Pinning](https://docs.dataton.com/watchout-7-new/watchout/effects-and-tweens/corner-pinning.html)). Zusammen ist das ein Paket im Umfang „M" (1–3 Personenwochen), das die Erwartung des Nutzers für Rechteck, Kreis, Dreieck und Polygon exakt erfüllt.

### Langfristig: Mesh und Triangulierung auf der GPU

Was CSS nicht kann, gehört in den GPU-Renderer. Wer die Textur einem Dreieck oder n-Eck *folgen* lassen will, statt sie nur zu beschneiden, braucht stückweise Abbildung: Ear-Clipping-Triangulierung und eine affine Abbildung pro Dreieck. In CSS hieße das eine geclippte Kopie des Videoelements pro Dreieck, also n−2 Decodes mit sichtbaren Nähten. In WebGL/WebGPU ist es dagegen eine Videotextur auf einem Mesh mit UVs. Für Quads müssen die UVs **homogen (perspektivkorrekt)** interpoliert werden. Nathan Reed zeigt, dass zwei linear interpolierte Dreiecke „an ugly seam" erzeugen, sofern das Quad kein Parallelogramm ist, während projektive Interpolation mit einer q-Koordinate pro Vertex die Naht entfernt ([Reed, Quadrilateral Interpolation](https://www.reedbeta.com/blog/quadrilateral-interpolation-part-1/)). Reed warnt allerdings, dass projektiv verzerrte **Nachbarzellen** an ihren Grenzen wieder Nähte bilden. Deshalb bieten WATCHOUT („Perspective Correction") und Kantan Mapper („Perspective" vs. „Bilinear") einen Umschalter an ([WATCHOUT Warp Geometry](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/warp-geometry.html); [Kantan Mapper](https://docs.derivative.ca/Palette:kantanMapper)). Dasselbe Mesh trägt den N×M-Grid- und Bezier-Warp *innerhalb* des Corner-Pins, wie TouchDesigners stoner zuerst den 4-Punkt-Keystone und dann das innere Mesh anwendet ([stoner](https://docs.derivative.ca/Palette:stoner)). Der stückweise affine „Linear"-Polygonwarp sollte eine Option sein, nicht der Standard, für Nutzer, die Vertices wie in Resolume direkt ziehen wollen. Ergänzend gehören eine explizite „anhängen an"-Option für Masken (Fläche, Input, Output) und eigene **Output-Space-Masken** dazu. Beides beantwortet die klassische Verwirrung „meine Maske hat sich beim Warpen mitbewegt", die Millumin-Nutzer schon 2014 hatten.

### Blend-Modes ohne Wirkung und weitere verifizierte Fehler

Der Blend-Mode-Fehler hat eine einfache Ursache. `mix-blend-mode` sitzt auf dem inneren `div` ([MediaFrame.tsx:488](../src/components/MediaFrame.tsx)), der Wrapper trägt aber immer `transform: rotate(...)` und `zIndex` ([MediaFrame.tsx:464-470](../src/components/MediaFrame.tsx)). Damit bildet er einen isolierten Stacking-Context, unter dem nichts zum Mischen liegt. Der Laufzeittest belegt das: `difference` Weiß-auf-Rot ergab mit identischer Struktur reines Weiß, ohne den Wrapper-Context dagegen Cyan. Die Korrektur verlegt `mix-blend-mode` auf den Wrapper und stellt sicher, dass zwischen Wrapper und Stage nichts isoliert.

| Fehler | Wirkung im Showbetrieb | Beleg | Korrektur | Aufwand |
|---|---|---|---|---|
| Doppelte SW-Registrierung plus `confirm()` | Modaler Dialog auf dem Projektor, Skripte stehen | [main.tsx:7-21](../src/main.tsx) | Registrierung nur über vite-plugin-pwa, ein Manifest, In-App-Toast | S |
| Blend-Modes wirkungslos | Grundfunktion des VJing fehlt | [MediaFrame.tsx:464-488](../src/components/MediaFrame.tsx) | Blend auf den Wrapper | S |
| Doppelter Polygon-Vertex | Degeneriertes Quad, Warp fällt aus | [Canvas.tsx:708-714](../src/components/Canvas.tsx) | `e.detail`-Filter, ε-Deduplizierung | S |
| `null`-Homographie ohne Fallback | Unverzerrter Inhalt in verzerrter Form | [MediaFrame.tsx:336-342](../src/components/MediaFrame.tsx) | Fallback auf bbox-H | S |
| Nicht-konvexe Quads erlaubt | Gefaltete Geometrie | [MediaFrame.tsx:182-194](../src/components/MediaFrame.tsx) | Konvexitätsprüfung beim Drag | S |
| Blackout und Master stumm nur im Bild | Ton läuft im Blackout weiter | [Canvas.tsx:1497-1499](../src/components/Canvas.tsx) | Audio-Gain an Master/Blackout koppeln | S |
| Autosave ohne try/catch | Speicherfehler bleiben unbemerkt, einziger Slot | [Canvas.tsx:321-327](../src/components/Canvas.tsx) | Fehlerbehandlung, sichtbarer Status | S |
| Löschen ohne Referenzprüfung | Frames verlieren still ihre Medien | [MediaLibrary.tsx:109-130](../src/components/MediaLibrary.tsx) | Warnung mit Verwendungsliste | S |
| Blob-URLs nie freigegeben | Speicherleck bei langen Sessions | [Canvas.tsx:1076](../src/components/Canvas.tsx) | `revokeObjectURL` im Lebenszyklus | S |
| Lint scheitert an `dev-dist` | CI kann nicht grün werden | [eslint.config.js:9](../eslint.config.js) | `dev-dist` ignorieren | S |
| Import ohne Schema-Validierung | NaN-Geometrie, ohne ErrorBoundary leerer Output | [storage.ts:165-198](../src/lib/storage.ts) | zod-Schema plus ErrorBoundary | M |

## Mapping-Geometrie ist Commodity, Workflow und Zuverlässigkeit entscheiden

Der Vergleich mit über 20 Produkten zeigt ein klares Muster. Die Geometrie ist ausgereift, und die etablierten Anbieter investieren nicht mehr dort. MadMapper hat 2024–2026 keine neuen Flächentypen oder Warp-Modelle eingeführt und seine Releases in Timelines, LED, Buffer und Integrationen gesteckt; die 6.2-Beta bringt Notch-Blocks, TouchDesigner-.tox, MediaPipe-Tracking und Webseiten als Medium ([GarageCube forum 6.2 beta](https://forum.garagecube.com/viewtopic.php?f=20&t=36481)). Resolume hat seit 2024 im Advanced Output nur Slice Transform und Keystone Mask schrittweise erweitert ([Resolume 7.28](https://resolume.com/blog/34630)). Gleichzeitig zeigt die Welle kleiner Browser-Mapper von 2025–2026, dass Corner-Pin in WebGL leicht zu bauen ist, oft mit KI-Unterstützung. **Commodity-Corner-Pin ist kein Burggraben, Politur, Zuverlässigkeit, Multi-Output und Workflow sind es.**

### VJ-Seite: der Video-Mapper erfüllt heute keine der Pflichtfunktionen

Legende: ✓ dokumentiert, ~ teilweise oder nur über Community-Lösungen, ✗ fehlt, ? nicht verifiziert.

| Fähigkeit | Resolume Arena 7.28 | VDMX6 | Synesthesia 1.25 | TouchDesigner | Smode Live | HeavyM Pro | **Video-Mapper (cea802b)** |
|---|---|---|---|---|---|---|---|
| Layer-Stack mit Blend-Modes | ✓ | ✓ | ~ Media über Szene | ~ selbst bauen | ✓ | ? | ✗ Blend wirkungslos |
| Clip-Launcher (Layer × Spalten) | ✓ | ~ Media Bin | ✗ Szenen/Presets | ~ SonomikaTD | ~ Cue-Liste | ~ Sequencer | ✗ ein Medium pro Frame |
| Beat-quantisierter Start | ✓ Beat Snap | ? | ~ Auto-Transition bei Drop | ✗ | ? | ? | ✗ |
| Autopilot / Follow-Actions | ✓ (+Transition-Kompensation 7.27) | ✓ Cue List | ✓ Playlists | ~ | ✓ Cue-Liste | ✓ Autopilot | ✗ |
| Crossfader, Transitions | ✓ (pro Clip seit 7.25) | ✓ Two Channel Mixer | ? | ~ | ? | ✓ | ✗ |
| Effekte, Shaderformat | 100+ FX, FFGL, ISF via Wire | ISF nativ, CoreImage, Vuo, TD | SSF, ISF-/Shadertoy-Import | GLSL, TOX | ISF, Notch, TD | Effekt- und Shaderbibliothek | 8 CSS-Filter |
| Tap-BPM / Ableton Link | ✓ / ✓ | ✓ / ✓ (+BPM-Erkennung, MIDI Clock out) | ✓ BPM-Erkennung / ? | ~ / ✓ | ✓ / ? | ? / ✓ | ✗ / ✗ |
| FFT-Audioreaktivität | ✓ pro Clip/Layer/Gruppe | ✓ | ✓ 38 Audio-Uniforms | ✓ | ✓ | ✓ | ✗ |
| MIDI Learn mit LED-Feedback | ✓ (+Presets) | ✓ | ✓ (+Pickup) | ~ | ✓ | ✓ | ✗ |
| OSC | ✓ | ✓ + OSCQuery | Pro | ✓ | ✓ | Pro | ✗ |
| REST/WebSocket, Web-Remote | ✓ (+MCP seit 7.26) | ✗ | ✗ | ~ selbst bauen | ? | ? | ✗ |
| Timecode LTC/MTC | ✓ SMPTE | ✓ LTC+MTC | ? | ? | ✓ LTC+MTC | ? | ✗ |
| Live-Inputs (Kamera, NDI) | ✓ | ✓ | ✓ (NDI Pro) | ? | ✓ | ✓ | ✗ |
| Multi-Display, Syphon/Spout/NDI out | ✓ | ✓ | Pop-out, Pro | ✓ | ✓ gestaffelt | ✓ | ✗ Vollbild im Editorfenster |
| Aufnahme des Outputs | ✓ DXV3 | ✓ | ✗ (OBS) | ✓ | ✓ Export | Pro+ | ✗ |
| GPU-Codec | DXV3, HAP | HAP inkl. HAP R | HAP/DXV empfohlen | HAP Q, NotchLC | ? | ? | ✗ ein `<video>` je Frame |
| Autosave / Crash-Recovery | ✗ nicht dokumentiert, gefordert | ? | ? | ? | ? | ? | ~ 1-s-Autosave, ein Slot |
| Plattform | Win/mac | mac | Win/mac | Win/mac | Win (NVIDIA) | Win/mac | Browser |

Quellen der Tabelle: [Resolume Clips](https://www.resolume.com/index.php/support/en/7/clips), [Resolume Parameter Animation](https://resolume.com/support/en/parameter-animation), [Resolume 7.25](https://resolume.com/blog/34172), [Resolume 7.26](https://resolume.com/blog/34484), [Resolume 7.27](https://resolume.com/blog/34561), [VDMX Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins), [VDMX Codecs](https://docs.vidvox.net/vdmx/vdmx_video_codecs), [Synesthesia Audio Uniforms](https://app.synesthesia.live/docs/ssf/audio_uniforms.html), [Synesthesia FAQ Video](https://app.synesthesia.live/docs/faq/video.html), [Smode Live](https://www.smode.io/en/product/live-media-server), [TD Movie File In](https://docs.derivative.ca/Movie_File_In_TOP), [SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106), [HeavyM Sequencer](https://help.heavym.net/hc/en-us/articles/9172061701138-The-Sequencer), [HeavyM OSC](https://help.heavym.net/hc/en-us/articles/11763711559058-OSC-API-Pro).

Resolume setzt mit seinem Raster aus Layern und Spalten, Spalten-Trigger, Beat Snap und Autopilot das mentale Modell, das Nutzer erwarten. Selbst die TouchDesigner-Community baut es mit SonomikaTD als „Flexible layer and column performance grid" nach ([SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106)). Der Trend 2025–2026 geht zu Computer-Vision-Effekten: Resolume 7.28 brachte Segmentierung und Tiefenschätzung als editierbare Wire-Patches ([Resolume 7.28](https://resolume.com/blog/34630)), VDMX im April 2025 Video Tracking und Remove Background ([VDMX blog](https://vdmx.vidvox.net/blog/vdmx6-update-video-tracking-ocr-scopes-color-transfer-and-more)). ISF ist der einzige herstellerübergreifende Shader-Standard: nativ in VDMX, in Resolume Wire, importierbar in Synesthesia und laut Herstellerseite in Smode ([isf.video](https://isf.video/)). FFGL ist dagegen nativer Binärcode und nicht webportierbar.

### Mapping-Seite: Parität fehlt bei Mesh, Outputs und Blending

| Fähigkeit | MadMapper 6.1 | Millumin 5.14 | HeavyM 2.15 | Resolume Arena 7.28 | WATCHOUT 7.8 | disguise r34 | MapMap (OSS) | **Video-Mapper** |
|---|---|---|---|---|---|---|---|---|
| Quad-Perspektive (Homographie) | ✓ | ✓ | ✓ Player | ✓ | ✓ | ✓ 3D | ✗ bilinear | ✓ CSS `matrix3d` |
| Perspektive auf Dreieck/Polygon | ~ Masken ans Quad | ~ Masken pre-warp | ✗ | ✗ nur linear | n/a | n/a 3D-Meshes | ✗ affin | ✓ Prinzip, 9 Abweichungen |
| Grid-/Mesh-Warp | ✓ Bezier | ✓ | ✓ 1–15 Unterteilungen | ✓ linear + Bezier | ✓ Bezier-Mesh | ✓ | ✓ | ✗ |
| Input/Output-Trennung | ✓ | ✓ | ~ Slice Selector | ✓ | ~ | ✓ | ✓ | ✗ |
| Masken mit Feather | ✓ | ✓ | ~ | ~ | ✓ | ✓ | ✗ | ~ nur bbox-Kanten |
| Output-Space-Masken | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edge-Blending | ✓ (BLC in 6.2β) | ✓ | ✓ Pro | ✓ inkl. BLC | ✓ automatisch | ✓ automatisch 3D | ✗ | ✗ |
| Mehrere Outputs, virtuelle Screens | ✓ | ✓ | ✓ Pro | ✓ | ✓ | ✓ | ✗ | ✗ |
| Farbkorrektur pro Output | ~ pro Fläche | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| 3D-Pose aus ≥6 Punktpaaren | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Kamera-Autokalibrierung | ~ Space Scanner | ✗ | ✗ | ✗ | ~ VIOSO | ✓ OmniCal | ✗ | ✗ |
| LED-Pixelmapping (Protokolle) | ✓ (Art-Net, sACN) | ✓ (Art-Net, sACN) | ✗ nur DMX-In | ✓ (nur Art-Net) | ~ Art-Net-Cues | ✓ (Art-Net, sACN) | ✗ | ✗ |
| Timeline, Cues, Timecode | ✓ | ✓ (+Timecode-Generierung) | ~ Timeline Pro, Timecode ? | ~ Spalten, SMPTE | ✓ | ✓ | ✗ | ✗ |
| Steuer-API | OSC, OSCQuery | OSC | OSC Pro | OSC, REST, WS, MCP | OSC, REST/SSE | REST | OSC (+MCP dev) | ✗ |
| Plattform | Win/mac (+MiniMad) | mac | Win/mac | Win/mac | Win | Win/Hardware | Win/mac/Linux | Browser |

Quellen der Tabelle: [MadMapper Warping](https://docs.madmapper.com/madmapper/6/4.-surfaces/warping-and-geometry), [MadMapper Soft-edge](https://docs.madmapper.com/madmapper/6/6.-outputs/soft-edge-blending), [Millumin Mapping](https://help.millumin.com/docs/playback/mapping/), [Millumin Masks](https://help.millumin.com/docs/playback/masks/), [HeavyM Players](https://help.heavym.net/hc/en-us/articles/360018687700-Drawing-and-editing-Players), [HeavyM Edge Blending](https://help.heavym.net/hc/en-us/articles/4410174789522-Blending-displays-seamlessly-with-the-Edge-Blending-module-Pro), [Resolume Input Selection](https://resolume.com/article/50), [Resolume Edge Blending](https://resolume.com/support/en/edge-blending), [Resolume DMX](https://resolume.com/support/en/dmx), [WATCHOUT Display Masks](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-masks.html), [WATCHOUT Edge Blending](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/edge-blending.html), [disguise Dynamic Blend](https://help.disguise.one/designer/stage-setup/projector-simulation/dynamic-blend), [disguise OmniCal](https://help.disguise.one/workflows/calibration-projection/omnical-overview), [MapMap manual](https://github.com/mapmapteam/mapmap/blob/dev/docs/manual/manual_en.rst).

Im Kern teilen alle reifen Werkzeuge eine Architektur: Sie trennen, **woher** Inhalt gesampelt wird (Input-Shape, Slice, Crop), von **wohin** er fällt (Output-Shape, Warp). Die Warps sind geschichtet, außen ein 4-Ecken-Perspektivpin, innen ein lineares oder Bezier-Grid, und pro Output (Screen, Canvas, Display) kommt eine zweite Warp- und Maskenstufe hinzu ([Resolume Advanced Output](https://resolume.com/support/en/advanced-output); [WATCHOUT Warp Geometry](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/warp-geometry.html)). Beim Edge-Blending hat sich Paul Bourkes Vokabular durchgesetzt: Breite pro Seite, Kurvenexponent, Mittenluminanz, Gamma pro RGB-Kanal und Schwarzwertkompensation ([Bourke, Edge blending](https://paulbourke.net/miscellaneous/edgeblend/); [Resolume Edge Blending](https://resolume.com/support/en/edge-blending)). Die Schwarzwertkompensation ist dabei noch selten: Resolume und disguise haben sie, MadMapper erst seit der 6.2-Beta im Oktober 2026. HeavyMs Modell aus einer Canvas mit rechteckigen „Screens", jeder mit eigenem Perspektiv- und Grid-Warp, Soft Edge und NDI, kommt der festen Komposition des Video-Mappers am nächsten ([HeavyM Output Setup](https://help.heavym.net/hc/en-us/articles/35039776578834-The-Output-Setup)).

Zwei Nutzerbeschwerden sind für das Datenmodell lehrreich. MadMapper speichert Flächengeometrie und Masken in Szenen; wer ein Projekt mit 40 Szenen vor Ort neu mappen muss, aktualisiert jede einzelne Szene ([GarageCube forum t=36417](https://forum.garagecube.com/viewtopic.php?f=20&t=36417)). Der Video-Mapper sollte „Stage, Outputs, Kalibrierung" deshalb von Anfang an als eigenes Dokument neben „Szenen, Cues, Content" führen. Außerdem wünschen sich MadMapper-Nutzer Kanten-Handles im Figma-Stil, weil sie versehentlich einzelne Vertices statt ganzer Kanten greifen ([GarageCube forum t=36370](https://forum.garagecube.com/viewtopic.php?f=29&t=36370)); auch das Sperren von Slices wird bei Resolume seit 2015 gefordert ([Resolume forum p=57385](https://www.resolume.com/forum/viewtopic.php?p=57385)).

### Preise und Lizenzmodelle 2026: unbefristete Lizenzen dominieren

| Produkt | Preis (Okt. 2026) | Modell | Demo / Gratisstufe | Plattform |
|---|---|---|---|---|
| Resolume Avenue / Arena / Wire | €299 / €799 / €399 | Unbefristet, 12 Monate Updates, „not a subscription" | Unbegrenzt, Wasserzeichen und Roboterstimme | Win/mac |
| VDMX6 / VDMX6 Plus | $199 / $349 (Start 2024: $99 / $249) | ? | Voll funktionsfähig, ohne Speichern | mac |
| Modul8 v3 | €299 (2 Rechner) | ? | Wasserzeichen, ohne Speichern | mac (Rosetta) |
| Synesthesia Standard / Pro | $199 / $399 | Unbefristet, 1 Jahr Updates, dann $60/Jahr | Unbegrenzt, Wasserzeichen | Win/mac |
| Smode | Auf Anfrage, Dongle | Stufen BASIC bis LIVE 4 | Community gratis (FHD, nicht-kommerziell) | Win/NVIDIA |
| TouchDesigner | Gratis / $300 / $600 / $2.200 | Unbefristet, 1 Jahr Updates | Non-Commercial bis 1280×1280 | Win/mac |
| MadMapper 6 | €479 (2 Seats) oder €44/Monat | Unbefristet für 6.x oder Miete | Wasserzeichen, ohne Speichern, DMX-Blackout alle 30 s | Win/mac |
| Millumin 5 | Lifetime ab €399; Miete €29/7 Tage, €69/30 Tage, €199/Jahr | Lifetime oder Miete | 30 Tage | mac |
| HeavyM Live / Pro / Pro+ | €219 / €439 / €539 oder €49/€99/€119 pro Monat (Rent-to-own) | Unbefristet mit 1 Jahr Updates | Ohne Speichern, Wasserzeichen | Win/mac |
| WATCHOUT 7 | €3.200 pro Node | Pro Server-Lizenz | Producer gratis | Win |
| disguise Designer Pro / X-Serie | $1.500/Jahr; X1–X3 $6.000–15.000/Jahr | Abo | Starter gratis mit Wasserzeichen | Win/Hardware |
| 4mapper | €39 einmalig | Freemium | 1 Projekt, 10 Dateien, 100 MB | Chrome/Edge |
| VJam | $27 einmalig | Freemium | 36 Presets | PWA |

Quellen: [Resolume shop](https://resolume.com/shop), [Resolume Renewals](https://resolume.com/article/88), [vidvox.net](https://vidvox.net/), [GarageCube shop](https://m8shop.garagecube.com/), [Synesthesia pricing](https://synesthesia.live/pricing), [Smode Live](https://www.smode.io/en/product/live-media-server), [TouchDesigner Licensing](https://derivative.ca/UserGuide/Licensing), [MadMapper software](https://madmapper.com/madmapper/software), [millumin.com](https://www.millumin.com/), [HeavyM pricing](https://www.heavym.net/pricing), [Dataton FAQ](https://www.dataton.com/downloads/faq-watchout-7/what-does-watchout-7-cost), [disguise Designer pricing](https://www.disguise.one/en/products/designer/pricing), [disguise X Series](https://www.disguise.one/en/products/x-series), [4mapper](https://4mapper.com/madmapper-alternative/), [HN: VJam](https://news.ycombinator.com/item?id=47178883).

Die Preisbänder sind klar: Einstiegs-VJ-Software kostet um €200–300, Profi-VJing mit Mapping, DMX und Timecode €400–800, Media-Server-Klasse ab $2.200 oder auf Anfrage. Der Markt scheut reine Abos; Resolume betont ausdrücklich „This is not a subscription". Unbegrenzte Testversionen mit Wasserzeichen, Mietoptionen für Gigs und Installationen sowie rund 50 % Bildungsrabatt sind Standard. Resolume legt genau die Mapping-Funktionen (Projection Mapping, Edge-Blending, DMX-Ausgabe, Slice Transforms, SMPTE) in das teurere Arena ([Resolume: Avenue vs Arena](https://resolume.com/support/en/avenue-arena-difference)). Der Markt behandelt Mapping also als Premiumstufe.

### Browser-Konkurrenz: viele Prototypen, kein Produktionswerkzeug

| Tool | Technik | Mapping | VJ-Funktionen | Reife (15.10.2026) | Modell |
|---|---|---|---|---|---|
| Ghost Arcade | Electron, Svelte 5, Three.js | Quad- und Mesh-Warp, Multi-Output-Slicing | 50+ FX, ISF v2, Web MIDI Learn, FFT, Handy-Companion im LAN | 11 Sterne, seit Mai 2026 | Open Core; Pro mit Spout/Syphon, KI-Shadern, Dual-Deck |
| 4mapper | HTML5/JS, Chrome/Edge | Corner-Pin, Multi-Szene | MP4/WebM/GIF, Cloud | Product Hunt: 1 Upvote | €39 einmalig |
| OpenVJ | Browser, TypeScript | Quad-Pin, Masken | Generativ, Mikrofon, MIDI | 7 Sterne, v0.2.0 | OSS |
| three-projection-mapper | three.js-Bibliothek | Corner plus bikubischer Grid-Warp, SDF-Masken, Feather, Multi-Window | – | 19 Sterne, „not recommended for production" | OSS |
| VJam | p5.js-PWA | – | 180+ Presets, Mikrofon-BPM, Handy als Controller | HN: 1 Punkt | $27 einmalig |
| Visual Fiha | React, Web Workers | Display-Fenster | Skripte, MIDI, Line-in | 20 Sterne | nicht-kommerziell |
| Hydra | WebGL, WebRTC | – | Live-Coding, Netzwerk-Streams | 2.729 Sterne | AGPL, Grants |
| cables.gl | WebGL-Patcher, Electron-Standalone | – | Web Audio, MIDI, Ableton Link | sehr aktiv | MIT, NLnet-gefördert |
| modV / Hedron | Electron | – / externes Display | ISF, NDI / MIDI Learn, MIDI Clock, Szenen-Crossfade | 494 / 516 Sterne | OSS |
| Ruido Visual Web VJ | Browser, WHIP/WebRTC | – | Compositing, FX, MIDI, Audio | Förderung ab Aug. 2026 | Libre, NLnet |

Quellen: [Ghost Arcade](https://github.com/riskcapital/ghost-arcade-community), [Product Hunt: 4mapper](https://www.producthunt.com/products/4mapper-web-based-projection-mapping), [OpenVJ](https://github.com/kniessner/openvj), [three-projection-mapper](https://github.com/bhoffmann93/three-projection-mapper), [HN: VJam](https://news.ycombinator.com/item?id=47178883), [Visual Fiha](https://github.com/zeropaper/visual-fiha), [Hydra](https://github.com/hydra-synth/hydra), [cables docs](https://cables.gl/docs/6_2_standalone/0_general/general), [modV](https://github.com/vcync/modV), [Hedron](https://github.com/nudibranchrecords/hedron), [NLnet: Ruido](https://nlnet.nl/project/Ruido/).

Echte Communities (500+ Sterne, aktiv) haben nur Hydra, Butterchurn, cables.gl, modV und Hedron, und keines davon ist ein schlüsselfertiges „Resolume im Tab" mit Clip-Decks und Produktions-Mapping. Ghost Arcade kommt funktional am nächsten, ist aber Electron, Open Core und ohne Traktion. Auffällig ist die **schwache kommerzielle Resonanz**: 4mapper erhielt auf Product Hunt einen Upvote, VJams Show HN einen Punkt ([HN 47178883](https://news.ycombinator.com/item?id=47178883)). Öffentliche Förderung gibt es dagegen: NLnet finanziert Ruido ausdrücklich als Browser-Alternative zu „expensive closed-source VJ software" ([NLnet: Ruido](https://nlnet.nl/project/Ruido/)). Vertrieb und Vertrauen in die Showsicherheit sind die eigentlichen Hürden, nicht die technische Machbarkeit.

### Pflicht versus Differenzierung

| Kategorie | Pflicht (fehlt das, wird man nicht ernst genommen) | Differenzierer 2026 | Video-Mapper heute |
|---|---|---|---|
| Content-Modell | Layer-Stack mit Blend-Modes, Clip-Launcher mit Spalten-Trigger, Crossfader, Autopilot | Transitions pro Clip, Musikstruktur-Automatik (Synesthesia-Drop) | Kein Clip-Modell, Blend defekt |
| Effekte | 50–100 GPU-Effekte und Generatoren, Webcam/Capture | ISF-/Shadertoy-Import, CV-Effekte (Segmentierung, Tiefe) | 8 CSS-Filter |
| Tempo | Tap-BPM, Ableton Link, Beat-Sync, FFT L/M/H mit Gain/Decay, LFO | KI-Beat-Tracking, DJ-Hardware-Sync | Nichts |
| Steuerung | MIDI Learn mit LED-Feedback und Templates (APC40/APC mini), OSC, Tastatur | REST/WebSocket, Web-Remote, MCP | Nur feste Shortcuts |
| Mapping | Quad-Pin, Mesh-Warp, Masken mit Feather, Edge-Blending, Multi-Output | Echte Perspektive auf jeder Form, Output-Space-Masken mit „attach to", Kamera-Kalibrierung | Quad-Pin ✓, Rest fehlt |
| Ausgabe | Multi-Display-Vollbild, NDI/Syphon/Spout, Aufnahme | Per-Screen-NDI, LED-Pixelmapping | Editorfenster im Vollbild |
| Zuverlässigkeit | Projekt speichern/laden, Presets, Medien neu verknüpfen | Autosave mit Versionen, Crash-Recovery, Show-Lock, Performance-HUD | Ein Autosave-Slot |
| Plattform | – | Echte Plattformunabhängigkeit inkl. Linux und ChromeOS, Zero-Install | Browser ✓ |

Die rechte Spalte der Differenzierer ist für einen Browser-Ansatz ungewöhnlich günstig. Autosave mit Versionshistorie und Crash-Recovery dokumentiert keines der großen VJ-Tools; Resolume-Nutzer fordern Autosave seit Jahren ([Resolume forum p=78333](https://resolume.com/forum/viewtopic.php?p=78333)). Einen Web-Remote mit REST/WebSocket hat Resolume erst seit 7.8 im Dezember 2021 ([Resolume 7.8](https://www.resolume.com/blog/21137/resolume-7-8-control-amp-monitor-arena-avenue-and-wire-via-the-rest-api)), für eine Web-App ist er nahezu gratis. VDMX und Modul8 sind macOS-only, Smode ist Windows/NVIDIA-only, und Resolume lehnt einen Linux-Port aus wirtschaftlichen Gründen ab ([Resolume forum p=26245](https://resolume.com/forum/viewtopic.php?p=26245)).

## Der Browser trägt 2026 einen GPU-Compositor, aber Ausgabe und Protokolle brauchen Chromium oder Electron

Stand 15. Oktober 2026 (Chrome/Edge 155, Firefox 158, Safari 27) lassen sich alle Rendering- und Dekodieraufgaben eines VJ-Tools im Browser lösen. Mehrere Projektoren, Netzwerkprotokolle und native Video-Schnittstellen bleiben dagegen Chromium oder einer Desktop-Hülle vorbehalten. Die folgende Matrix beruht auf MDNs browser-compat-data 8.1.6 vom selben Tag ([BCD 8.1.6](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)).

| Fähigkeit | Chrome/Edge | Firefox | Safari | Konsequenz |
|---|---|---|---|---|
| WebGPU | ✓ Win/mac/ChromeOS ab 113; Linux nur Intel Gen12+ (144) und NVIDIA/Wayland (147); Windows-ARM hinter Flag | Windows (141), Apple Silicon (145/147); **nicht Linux, nicht Intel-Mac** | ✓ ab 26 | WebGL2-Fallback bleibt Pflicht |
| `importExternalTexture` (Zero-Copy-Video) | ✓ | **nur Windows** | ✓ 26 | Sonst `copyExternalImageToTexture` mit einer GPU-Kopie |
| WebCodecs `VideoDecoder` | ✓ 94 | ✓ 130 | ✓ 16.4 | Frame-genaue Wiedergabe überall möglich |
| `requestVideoFrameCallback` | ✓ 83 | ✓ 132 | ✓ 15.4 | Upload nur bei neuem Frame |
| OffscreenCanvas im Worker | ✓ 69 | ✓ 105 | ✓ 16.4 | Renderer im Worker portabel |
| `getScreenDetails`, `requestFullscreen({screen})` | ✓ 100 | ✗ | ✗ | **Multi-Projektor nur in Chromium** |
| Web MIDI | ✓ (Prompt seit 124) | ✓ 108 (Add-on-Freigabe) | **✗** | Safari braucht Bridge |
| Rohes UDP (OSC, Art-Net, sACN, Link) | nur Isolated Web Apps | ✗ | ✗ | Companion oder Desktop-Hülle |
| Ordner direkt nutzen (File System Access) | ✓ 86, dauerhafte Rechte ab 122 | ✗ (nur OPFS) | ✗ (nur OPFS) | Sonst Medien in OPFS kopieren |
| Speicherquote | ~60 % der Platte | 10 GiB best effort, 50 % mit `persist()` | ~60 %, Löschung nach 7 Tagen ohne Interaktion | `persist()` Pflicht |
| Screen Wake Lock | ✓ 84 | ✓ 126 | ✓ 16.4 | In jedem Output-Fenster anfordern |

Zusätzliche Quellen: [gpuweb Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [Chrome: Web MIDI permission](https://developer.chrome.com/blog/web-midi-permission-prompt), [blink-dev: Direct Sockets](https://groups.google.com/a/chromium.org/g/blink-dev/c/5R0P_aYBWQI), [Chrome: persistent FSA permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api), [MDN: Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### Rendering und Video: WebGPU zuerst, WebCodecs für Präzision, HAP als offene Lücke

Für den Compositor ist **three.js `WebGPURenderer` mit TSL** derzeit der pragmatischste Weg zu „WebGPU mit automatischem WebGL2-Fallback". Ein Shader-Graph wird zur Laufzeit nach WGSL oder GLSL übersetzt ([sbcode: WebGPU renderer](https://sbcode.net/threejs/webgpu-renderer/)). Der Preis sind TSL-Bindung und Fallback-Bugs, etwa ein defektes `copyTextureToTexture` im WebGL-Pfad ([three.js #31950](https://github.com/mrdoob/three.js/issues/31950)). Der Video-Schnellpfad `importExternalTexture` hat eine strikte Regel: Externe Texturen verfallen als Microtask. Import und Zeichnen müssen deshalb im selben Callback ohne `await` dazwischen geschehen, mit neuer Bind Group pro Frame ([Toji: WebGPU video textures](https://toji.dev/webgpu-best-practices/img-textures.html)). Kalte Shader-Kompilierung kann 200 ms überschreiten, Pipelines sollten also vor der Show aufgewärmt werden ([Utsubo 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)). Mesh-Warp, Edge-Blending und ISF-artige Effekte sind gewöhnliche Shaderarbeit. Eine gepflegte WebGPU-fähige ISF-Runtime wurde aber nicht gefunden: Der Referenz-Renderer `interactive-shader-format-js` nutzt einen WebGL1-Kontext und hat 20 offene Pull Requests ([ISF-JS](https://github.com/msfeldstein/interactive-shader-format-js)).

Ein VJ-Tool braucht zwei Wiedergabe-Engines. Einfache Loops laufen über `<video>` plus `requestVideoFrameCallback` plus `importExternalTexture`: günstig und hardwaredekodiert, aber mit grobem Seek und Sync. Frame-genaue, taktgebundene Wiedergabe (BPM-synchrones Scrubbing, Rückwärtslauf, Sync über Layer) läuft über WebCodecs mit Demuxer im Worker. Mediabunny (v1.61.4, reines TypeScript) liest MP4, MOV, MKV und WebM ([Mediabunny](https://github.com/Vanilagy/mediabunny)). H.264 dekodiert auf 99,6 % der Geräte, VP9 auf 99,96 %, AV1 auf 87,9 % und HEVC nur auf 73,6 % ([MDN: Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)). **HAP und ProRes haben keinen nativen Browser-Decoder.** Für ProRes gibt es eine WASM-Erweiterung, die für Multithreading Cross-Origin-Isolation braucht ([Mediabunny ProRes](https://mediabunny.dev/guide/extensions/prores)). Ein Browser-HAP-Player existiert nicht; GitHub-Suchen nach HAP-Decodern für WebGL, WASM oder WebGPU blieben am 15.10.2026 ohne Treffer. Technisch wäre er machbar: Snappy-Dekompression in WASM, dann Upload der DXT/BC-Blöcke in eine `texture-compression-bc`-Textur. Dieses Feature melden 99,99 % der Windows-, 87,34 % der macOS-, aber nur 54,91 % der iOS- und 35,1 % der Android-Geräte ([web3dsurvey](https://web3dsurvey.com/webgpu/features/texture-compression-bc)). HAP wäre also ein Desktop-Differenzierer. Decoder-Slots sind endlich: Chromiums VA-API-Decoder erlaubt **16 gleichzeitige Decoder** ([Chromium commit](https://chromium.googlesource.com/chromium/src/+/c74bb01a2889afdfdd1e06f0144fb7b02e2e00a2)), für Windows und macOS ist keine Grenze dokumentiert. Belastbare Messungen, wie viele 1080p-Streams pro Frame importierbar sind, gibt es nicht. Das ist das **größte technische Einzelrisiko** und muss früh auf Referenzhardware gemessen werden.

### Multi-Display, Steuerprotokolle und Speicher

Nur Chromium kann Bildschirme aufzählen und gezielt im Vollbild bespielen. Das Muster lautet: `getScreenDetails()`, auf `screenschange` hören, ein Popup pro Projektor öffnen und mit `requestFullscreen({screen})` platzieren ([web.dev: multiple screens](https://web.dev/articles/web-apps/multiple-screens)). Jedes `window.open()` braucht eine eigene Nutzergeste ([MDN: Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API/Using)). Vollbild auf mehreren Displays mit einer Geste erlaubt nur die Einstellung „Automatic Fullscreen", die ausschließlich Enterprise-Policy oder Isolated Web Apps gewähren ([blink-dev: Automatic Fullscreen](https://groups.google.com/a/chromium.org/g/blink-dev/c/WOch5LPq9RY)). Output-Fenster müssen sichtbar bleiben, denn rAF pausiert in Hintergrund-Tabs, und Chromium drosselt verdeckte Fenster unter Windows ([Chromium commit](https://chromium.googlesource.com/chromium/src/+/55bef1db2cd4e5da5ef1636ff3025f1180f61399)). Ob ein `GPUDevice` aus einem Fenster in ein Canvas eines gleich-originigen Popups rendern kann, ist unbelegt. Der robuste Standard lautet deshalb: Szenenzustand replizieren und in jedem Output-Fenster lokal rendern.

Browser können kein UDP öffnen. OSC, Art-Net, sACN und Ableton Link brauchen daher einen lokalen Companion (Node oder Rust) oder eine Desktop-Hülle; Direct Sockets gibt es nur in Isolated Web Apps, und Mozilla bewertet sie als „Harmful" ([blink-dev: Direct Sockets](https://groups.google.com/a/chromium.org/g/blink-dev/c/5R0P_aYBWQI)). Für OSC existieren fertige UDP↔WebSocket-Brücken ([osc-js](https://npmjs.com/package/osc-js); [node-osc](https://github.com/MylesBorins/node-osc)), für Link der TCP-Wrapper Carabiner ([Carabiner](https://github.com/Deep-Symmetry/carabiner)). USB-DMX-Interfaces der Enttec-Klasse sind über Web Serial erreichbar ([MDN Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)). NDI, Syphon und Spout gibt es im Browser nicht; als Notlösung bleiben virtuelle Webcams und NDI→WHEP-Gateways ([Softvelum](https://softvelum.com/2025/07/ndi-whep-webrtc-workflow/)). Echte GPU-Interop bietet nur Electron mit dem experimentellen `sharedTexture`-API, das native Handles in `VideoFrame`s überführt ([Electron sharedTexture](https://www.electronjs.org/docs/latest/api/shared-texture)), und mit Community-Addons für Spout/Syphon in beide Richtungen ([electron-texture-bridge](https://github.com/naporin0624/electron-texture-bridge)). Audio ist unkritisch: `AnalyserNode` und `AudioWorklet` laufen überall, und `realtime-bpm-analyzer` liefert Live-BPM per AudioWorklet ([realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer)). Für Musik-Input müssen Echo-Cancellation, Rauschunterdrückung und AGC abgeschaltet werden. Beim Speicher kann Chromium große Medienordner **an Ort und Stelle** referenzieren, installierte Apps behalten die Rechte dauerhaft; Firefox und Safari müssen in OPFS kopieren.

### Architekturempfehlung: Szenenmodell, Renderer-Kern, Host-Schnittstelle

React bleibt ausschließlich die Steueroberfläche. Die gesamte Bildausgabe wandert in einen frameworkfreien **Renderer-Kern**, gespeist von einem serialisierbaren Szenengraphen. Diese Trennung ist zugleich die Voraussetzung, um einen Gerätverlust (`device.lost`) zu überleben: Nach dem Verlust müssen alle Buffer, Texturen und Pipelines aus dem Szenenmodell neu erzeugt werden, notfalls auf WebGL2 ([LuciadRIA: device loss](https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/articles/howto/view/webgpu_device_loss.html)).

| Schicht | Verantwortung | Technik |
|---|---|---|
| Szenenmodell | Zwei Dokumente: **Stage** (Komposition, Screens, Slices, Warp vom Corner-Pin über Grid bis Bezier, Masken, Blend-Parameter, Kalibrierung) und **Show** (Layer, Decks, Clips, Effekte im ISF-Parameterschema, Szenen, Cues, MIDI-Map) | Reines TypeScript, Store (Zustand o. ä.), zod-Validierung, versionierte Migrationen |
| Renderer-Kern | Pro Frame: Takt → Frames aus Quellen → Layer-Texturen → Effekt-Passes → Kompositionstextur; pro Output und Slice: Input-Rechteck auf Warp-Mesh, Maske, Blend-Rampe, Present | WebGPU mit WebGL2-Fallback, OffscreenCanvas im Worker; DOM-Renderer bleibt als Debug-/Fallback-Ansicht |
| Quellen | `<video>` + rVFC; WebCodecs-Decoder-Pool + Mediabunny; `getUserMedia`/`getDisplayMedia`; Bilder; Desktop: Syphon/Spout/NDI | Decoder poolen, unsichtbare Layer pausieren |
| Output-Manager | PWA: `getScreenDetails`, Popups, `requestFullscreen({screen})`, Zustand via BroadcastChannel; Electron: native `BrowserWindow` pro Display | Wake Lock, Hot-Plug, Wiederherstellung |
| Host-Services | `listDisplays/openOutput`, `midi`, `osc/artnet/link`, `mediaLibrary`, `textureIO` | PWA: WebSocket zum Companion; Electron: IPC |
| Takt | Eine Master-Clock im Steuerkontext, optional an Link oder MIDI-Clock gekoppelt; Outputs rendern per rAF, sampeln aber die gemeinsame Uhr | `performance.now()` |

Die Migration folgt dem Prinzip „Parität zuerst". Der GPU-Renderer bildet hinter einem Feature-Flag zunächst die heutigen Funktionen nach (Corner-Pin, Clip-Masken, Video). Danach kommen Mesh-Warp und Edge-Blending, dann der WebCodecs-Pfad, die Output-Fenster, der Electron-Host und zuletzt HAP sowie native Textur-I/O.

### PWA, Electron oder Tauri: Chromium-PWA plus Electron-Pro-Build

| Bedarf | PWA (Chromium) | PWA (Safari/Firefox) | Electron 44 | Tauri v2 (mac: WKWebView, Win: WebView2) |
|---|---|---|---|---|
| WebGPU-Compositor | ✓ (Linux teilweise) | Safari 26+ ✓; Firefox nur Win/Apple Silicon | ✓ Chromium 152 | mac: Safari-Engine; Win: Chromium |
| Vollbild pro Projektor | ✓ (eine Geste pro Output) | ✗ | ✓ native Fenster | ✓ native Fenster |
| Web MIDI | ✓ | Firefox ✓, Safari ✗ | ✓ | Win wahrscheinlich, **mac ✗** |
| OSC, Art-Net, Link | Companion nötig | Companion nötig | Main-Prozess | Rust-Kern |
| Syphon, Spout, NDI | nur virtuelle Webcam | dito | native Addons, Zero-Copy | eigenes Rust-Plugin, Frame-Kopie |
| Medien an Ort und Stelle | ✓ FSA | ✗ OPFS-Kopie | ✓ natives FS | ✓ natives FS |
| Installationsgröße | 0 | 0 | ~80–200 MB | ~3–10 MB |

Quellen: [Electron releases](https://releases.electronjs.org/releases.json), [Tauri webview versions](https://v2.tauri.app/reference/webview-versions/), [Tauri v3 alpha](https://newreleases.io/project/github/tauri-apps/tauri/release/tauri-v3.0.0-alpha.0), [tech-insider: Tauri vs Electron](https://tech-insider.org/tauri-vs-electron-2026/).

Die Empfehlung lautet: **eine Codebasis, zwei Auslieferungen.** Die React/Vite-PWA bleibt das Zero-Install-Tier für Chromium und zugleich der Handy-Remote. Ein Electron-Build (aktuell v44.7.2 mit Chromium 152) wird das „Pro/Show"-Produkt mit nativen Output-Fenstern, UDP-Protokollen, Autostart und Textur-Interop. Electron verhält sich auf allen Plattformen identisch und ist der einzige Wrapper mit dokumentierter Shared-Texture-Infrastruktur; das bestätigen cables.gl Standalone, modV und Hedron, die alle Electron nutzen ([cables docs](https://cables.gl/docs/6_2_standalone/0_general/general)). Tauri v2 ist kleiner, bringt auf macOS aber Safaris Engine mit: kein Web MIDI, keine Zero-Copy-Texturen und nur etwa 15 % Speicherquote pro Origin. Tauri lohnt eine Neubewertung, sobald die CEF-Runtime der v3-Alpha stabil ist. Firefox und Safari bekommen offiziell einen Single-Output-Modus; ein Ringen um Multi-Projektor-Parität dort lohnt nicht.

## Produktionsreife lässt sich in 18 testbaren Kriterien fassen

Praktiker fürchten vor allem drei Dinge: Totalabstürze (oft Grafiktreiber, MIDI-Clock, Plugins oder USB-Hubs), Outputs, die beim Wiederverbinden von Displays still schwarz werden oder flackern, und Ruckler beim Clip-Trigger ([Resolume forum p=98759](https://resolume.com/forum/viewtopic.php?p=98759); [Resolume forum p=80786](https://www.resolume.com/forum/viewtopic.php?p=80786); [Resolume forum p=21325](https://www.resolume.com/forum/viewtopic.php?p=21325)). Profi-Tools antworten mit geschichteten Absicherungen: Resolume hat einen Panik-Shortcut (Ctrl+Shift+D schaltet alle Outputs ab) ([Resolume forum p=98177](https://resolume.com/forum/viewtopic.php?p=98177)) und für Installationen die Option „Trigger First Clip when Composition Has Loaded" ([Resolume Preferences](https://resolume.com/support/en/preferences)). Smode bietet eine UI-Sperre mit Passwort ([Smode UI Lock](https://www.smode.io/documentation/ref/ui/user-interface-lock.htm)), Millumin „Silent Edition" für unbemerktes Editieren laufender Shows, WATCHOUT einen automatischen Failover „within seconds" ([WATCHOUT Network](https://docs.dataton.com/watchout-7-new/watchout/network-setup/network-overview.html)). Millumins offizielle Backup-Methode braucht dagegen den Drittanbieter-Relay Chataigne und spiegelt nur Spaltenstarts ([Millumin backup machine](https://help.millumin.com/v4/tutorials/setup-a-backup-machine/)).

### Die Kriterien

Die Schwellenwerte sind Vorschläge aus der Recherche, keine Industrienormen. Sie machen „produktionsreif" aber prüfbar.

| ID | Kriterium | Schwelle | Prüfung | Vorbild |
|---|---|---|---|---|
| R1 | Dauerstabilität | ≥8 h bei Referenzlast (4 Layer, Effekte, 2 Outputs) mit 0 Abstürzen, 0 Fenster-Exits, flachem Heap/VRAM; 72 h für Installationen | Soak-Test mit Speicherprofil | – |
| R2 | Output-Resilienz | Nach Display-Abziehen, Auflösungswechsel oder Kontextverlust in ≤5 s wieder im Vollbild auf dem richtigen Display, protokolliert | Hot-Plug-Test, `device.lost` provozieren | Forum-Klagen über schwarze Outputs |
| R3 | Crash- und Reload-Recovery | Autosave ≥ alle 30 s und bei jeder Strukturänderung; vollständige Wiederherstellung inkl. MIDI-Map; optional erster Cue beim Laden | Tab-Kill und Reload | Resolume-Installationsrezept |
| R4 | Show-Lock | Destruktive Edits gesperrt, Schließen/Navigation abgesichert, Entsperren mit PIN; Output läuft beim Editieren weiter | Manuell und E2E | Smode, Millumin |
| R5 | Panik-Controls | Blackout, Freeze, Fallback-Bild per Taste und MIDI, wirksam in ≤1 Frame | Frame-Messung | Resolume Ctrl+Shift+D |
| R6 | Preflight | Prüft fehlende Medien, Codec-Support, VRAM, Nicht-stören, Energiesparen, MIDI-Gerät; Go/No-Go-Liste | Checkliste | VIDVOX „Gig Ready" |
| R7 | Trigger ohne Ruckler | 0 verlorene Frames auf anderen Layern; vorgeladene Clips starten in ≤1 Frame, kalte in ≤100 ms; explizites „Arm/Cue" | Frame-Timing-Log | Forum: fehlendes Preload |
| R8 | Redundanz | Spiegelung des Show-Zustands an eine zweite Instanz im LAN, mindestens Cue-/Spaltenstarts | Zwei-Rechner-Test mit Switcher | WATCHOUT, Millumin |
| R9 | Offline | ≥30 Tage ohne Netz inkl. Lizenz; Aktivierung und Deaktivierung offline | Flugmodus-Test | Resolume 30-Tage-Phone-home |
| R10 | Diagnose | Frame-Time- und Drop-Anzeige; exportierbares Log-Bundle | Manuell | Klage: Crash-Logs unauffindbar |
| P1 | Frame-Budget | 60 fps (p99 ≤16,7 ms, <1 Drop pro 10 min) bei 1080p mit ≥4 Videolayern, 2 Effekten und Mapping auf Referenzhardware; 4K30 unterstützt | In-App-Benchmark | disguise-Layertabellen |
| P2 | Latenz | Controller-zu-Photon ≤2 Frames (≤33 ms) für vorgeladene Clips | Hochgeschwindigkeitskamera | ITU-R BT.1359: +45 ms Erkennbarkeit |
| P3 | Codec-Strategie | Intra-freundliche Auslieferung (kurze GOPs, All-Intra) plus Preload; Transcoding-Hinweise | Benchmark-Matrix | Keyframe-Seek-Ruckler bei H.264 |
| P4 | Benchmark-Szene | Eingebaute Szene (N Layer × Auflösung × Codec) meldet maximal stabile Layerzahl | Ausliefern | Resolume-Benchmark-Dateien |
| O1 | Offline-first | App, Medien, Shader, Lizenz lokal; Lizenzprüfung blockiert nie den Output | Netztrennung | – |
| O2 | Medien-Privatsphäre | Lokale Verarbeitung, Cloud-Sync nur opt-in | Review | – |
| O3 | Content-Lizenzen | Nur MIT/CC0/CC-BY-Shader bündeln; Warnung beim Import nicht-kommerzieller Inhalte | Lizenz-Metadaten | Shadertoy-Default CC BY-NC-SA |
| O4 | Telemetrie | Opt-in-Crashreports, Diagnose-Bundle offline sammelbar, nie im Render-Pfad | Review | – |

Quellen: [disguise EX 3 performance](https://help.disguise.one/hardware/performance/ex3-performance), [Audio-Video-Synchronisation](https://en.wikipedia.org/wiki/Audio-to-video_synchronization), [VIDVOX Gig Ready](https://docs.vidvox.net/vv-edu/handout_module_6_3), [Resolume article 28](https://resolume.com/article/28), [Three.js manual: Shadertoy](https://threejs.org/manual/en/shadertoy), [Magic Music Visuals forum](https://magicmusicvisuals.com/forums/viewtopic.php?p=9445).

Für P1 lohnt Realismus: Ein dedizierter disguise EX 3 spielt bei 1080p 30 HAP-Layer mit 60 fps ([disguise EX 3](https://help.disguise.one/hardware/performance/ex3-performance)). Ein Browser-Tool konkurriert nicht über die Layerzahl, sondern über Zugänglichkeit. Besonders wichtig ist O3: Shadertoy-Code steht standardmäßig unter CC BY-NC-SA 3.0, was laut Forenadministratoren schon VJing auf kommerziellen Events ausschließt.

### Zielsegmente und Positionierung

| Segment | Kernschleife | Pflichtfunktionen | Eignung des Browser-Ansatzes | Ab Phase |
|---|---|---|---|---|
| Club- und Festival-VJ (Einstieg/Mitte) | Sofortiges Clip- und Effekt-Triggern, BPM, MIDI | Launcher, Beat Snap, FFT, MIDI-Templates, Output-Fenster | Gut (Chromium) | 2 |
| Mapping-Einstieg und -Mitte | Präzises Warpen, Masken, Multi-Output, Blending | Mesh-Warp, Output-Masken, Edge-Blending | Gut, Multi-Output nur Chromium/Electron | 3 |
| Bildung, Hobby, Kirchen, kleine Venues | Schneller Einstieg, niedriger Preis, Vorlagen | Zero-Install, Tutorials, Templates | Sehr gut, Chromebooks und Linux inklusive | 0–2 |
| Event-AV und Corporate | Timecode, Cue-Listen, Redundanz | LTC/MTC, „alle Layer cuen", Failover | Erst mit Electron-Pro | 4 |
| Feste Installationen und Museen | Autostart, Zeitplan, unbeaufsichtigter Betrieb | Boot-Autostart, ICS-Plan, Health-Endpoint, Offline-Lizenz | Erst mit Electron-Pro | 4 |

Die Positionierung ergibt sich aus belegten Beschwerden: Preis und Stufenschnitt (Avenue €299 vs. Arena €799 genau entlang der Mapping-Funktionen), Plattformbindung (Millumin: „For now, we are focused on the Mac version"; [millumin.com](https://millumin.com/)), fehlendes Autosave, steile Lernkurven (TouchDesigner) und fummelige Controller-Einrichtung. Das APC40-mkII-Preset wird bei Resolume nicht automatisch gewählt, die LEDs bleiben dunkel, bis „Output MIDI" aktiv ist ([Resolume forum p=67076](https://resolume.com/forum/viewtopic.php?p=67076)), und das APC40 mkII selbst ist abgekündigt ([Resolume forum p=92776](https://www.resolume.com/forum/viewtopic.php?p=92776)). Die Positionierung lautet daher: **„Zero-Install-VJ und -Mapping mit Showsicherheit: läuft auf jedem Rechner, verliert nie die Arbeit, steuerbar vom Handy."** Einsteiger-Clubs, Mapping-Einstieg und Bildung kommen zuerst. Event-AV und Installationen folgen als Pro-Stufe, sobald R1–R10 erfüllt sind.

### Geschäftsmodell-Optionen

| Option | Vorbild | Stärke | Schwäche |
|---|---|---|---|
| Freemium mit Wasserzeichen und 1080p-Grenze, Pro monatlich/jährlich, Show-Pass pro Tag/Woche, unbefristete Offline-Installationslizenz | Synesthesia, Resolume-Demo, Millumin-Miete, QLab | Deckt Gig-, Abo- und Installationsbedarf ab | Abo-Skepsis; braucht „letzte Version bleibt"-Garantie |
| Web-Tier gegen Electron-Pro-Tier (NDI, Syphon/Spout, Art-Net, Multi-Output, Autostart) | Resolume Avenue/Arena, HeavyM Live/Pro/Pro+ | Technische Grenze = Preisgrenze, für Nutzer nachvollziehbar | Zwei Builds pflegen |
| Open Core mit OSS-Kern und Fördermitteln | Ghost Arcade, cables.gl, Ruido (NLnet) | Community, Vertrauen, Grants realistisch | Monetarisierung schwach; CDM bezweifelt die Marktgröße für kommerzielle Tools dieser Art |
| Niedriger Einmalpreis | 4mapper €39, VJam $27 | Niedrige Hürde | Verankert den Preis zu tief, finanziert keine Show-Zuverlässigkeit |

Quellen: [HeavyM pricing](https://www.heavym.net/pricing), [Synesthesia pricing](https://synesthesia.live/pricing), [Resolume forum p=42714 („rent license … like QLab")](https://www.resolume.com/forum/viewtopic.php?p=42714), [CDM: cables June 2025](https://cdm.link/cables-june-2025/).

Am tragfähigsten ist eine Kombination der ersten beiden Zeilen. Die Recherche leitet aus den Preisankern etwa €8–15 pro Monat oder €99–199 pro Jahr für eine individuelle Pro-Stufe ab, plus Tages- oder Wochenpässe für Events. Das sind Vorschläge, keine validierte Zahlungsbereitschaft, und sie liegen bewusst unter Avenue. Lizenzen sollten pro Nutzer statt pro Maschine gelten. Das adressiert direkt die Beschwerden über Lizenzumzüge und Offline-Deregistrierung ([Resolume forum p=86374](https://www.resolume.com/forum/viewtopic.php?p=86374)). Weil Launch-Posts für Browser-Tools nachweislich verpuffen, gehört der Vertrieb in Bildung (Workshops, Chromebook-Klassen), in Low-Budget-Events und in Halloween-/Heim-Mapping, nicht in den Frontalangriff auf Resolume-Profis.

## Sechs Phasen, in denen jede Stufe die nächste freischaltet

Die Reihenfolge folgt drei harten Abhängigkeiten. Erstens kommt das **Szenenmodell vor jedem neuen Feature**: Ohne Store, versioniertes Schema und die Aufteilung in Stage- und Show-Dokument muss jedes spätere Feature zweimal gebaut werden, und ohne Clip/Deck-Modell gibt es kein Triggering. Zweitens kommt die **Renderer-Abstraktion vor Mesh-Warp, Effekten, echten Blend-Modes, Transitions, Edge-Blending, Aufnahme und Live-Inputs**, denn all das ist im CSS-Renderer unmöglich oder doppelte Arbeit. Drittens kommen **Output-Fenster vor Screens/Slices und Blending**, weil Projektor-Blending erst nach dem Warp pro Output auf einem Output-großen Canvas stattfinden kann. Output-Fenster hängen dagegen nur am replizierbaren Szenenmodell, nicht am GPU-Renderer, und können deshalb parallel entstehen. Die Kette lautet: Phase 0 (unabhängig) → Store und Schema → Clip-Modell → Launcher → Transport/BPM → Cue-Liste; parallel Store und Schema → Renderer-Abstraktion → Effekte, Mesh-Warp, Blend, Transitions → Screens/Slices → Edge-Blending → virtuelle Screens → LED; daneben Store → Output-Fenster → Screens/Slices; Companion/Electron → OSC, Art-Net, Link, NDI, Autostart; API → Web-Remote → MCP.

Aufwandsskala (eigene Schätzung für eine erfahrene Entwicklerperson): **S** ≤1 Personenwoche, **M** 1–3, **L** 3–8, **XL** mehr als 8 Personenwochen. Die Phasendauern gelten für ein Team von ein bis zwei Personen und sind Größenordnungen, keine Zusagen.

### Phase 0: Stabilisieren und Show-Blocker beseitigen (ca. 3–6 Personenwochen)

| # | Arbeitspaket | Begründung | Abhängig von | Aufwand | Schließt Lücke zu |
|---|---|---|---|---|---|
| 0.1 | SW nur über vite-plugin-pwa, ein Manifest, Update als Toast statt `confirm()` | Modaler Dialog auf dem Projektor ist ein Release-Blocker | – | S | Grundvoraussetzung jeder Show |
| 0.2 | `mix-blend-mode` auf den Wrapper | Blend-Modes sind VJ-Pflicht und heute wirkungslos | – | S | Resolume, VDMX (Layer-Stack) |
| 0.3 | Photoshop-Hülle: bbox-Refit, `invertHomography`, Vertex-Handles und Umriss durch H, Polygon-Resize, numerisches W/H skaliert Pins, Rahmen als Overlay, Hit-Test über H(bbox) | Erfüllt die TODO-Anforderung für alle Formen | – | M | Übertrifft Resolume-Poly-Slices |
| 0.4 | Warp-Modus bereinigen (Fallback, Reihenfolge, „An Vertices pinnen"), Polygon-Duplikat-Fix, Konvexitätsprüfung | Beseitigt Abweichungen 4–6 und gefaltete Geometrie | 0.3 | S | WATCHOUT (konvexer Pin) |
| 0.5 | Sicherheitsnetz: Autosave mit Fehlerbehandlung, ErrorBoundary mit schwarzem Fallback, Blackout schaltet Ton stumm, `persist()`, Löschwarnung, Blob-URL-Freigabe | Datenverlust und Tonlecks im Blackout | – | S | Autosave-Lücke bei Resolume |
| 0.6 | Lint-Konfiguration, Vitest-Basis für `geometry.ts` und `storage.ts`, CI | Sicherheitsnetz für den Umbau | – | S | – |
| 0.7 | README auf Ist-Stand bringen | Zwölf falsche Aussagen untergraben Vertrauen | – | S | – |

### Phase 1: Fundament (ca. 4–6 Monate)

| # | Arbeitspaket | Begründung | Abhängig von | Aufwand | Schließt Lücke zu |
|---|---|---|---|---|---|
| 1.1 | Store (z. B. Zustand), Aufteilung von Canvas/MediaFrame, Gesten-State in Refs plus rAF | Re-Render pro Mausbewegung, God-Components | 0.6 | M | – |
| 1.2 | Schema v5 mit zod und Migrationskette; Stage- und Show-Dokument getrennt; Geometrie normalisiert, damit Auflösungswechsel mitskalieren | Version wird nie gelesen; MadMapper-Lehre „Szenen speichern Geometrie" | 1.1 | M | MadMapper-Schwäche vermeiden |
| 1.3 | Datenmodell-Wechsel: Frame → Surface/Slice (Stage) plus Layer mit Clip-Slots (Show) | Ein Medium pro Frame blockiert Triggering | 1.2 | L | Resolume-Clipmodell |
| 1.4 | Projektverwaltung: mehrere Projekte, versionierte Backups, FSA-Ordner (Chromium), OPFS, Zip-Paket statt Base64 | Ein Slot, V8-String-Limit, Eviction | 1.2 | M | Resolume Media Manager, Autosave |
| 1.5 | Renderer-Abstraktion; GPU-Renderer (WebGPU, WebGL2-Fallback) erreicht Parität hinter Feature-Flag; `device.lost`-Recovery | Basis für alle GPU-Features | 1.1, 1.2 | XL | Alle Mapping-/VJ-Tools |
| 1.6 | Video-Benchmark-Spike: N Videos × Auflösung × Codec, `<video>` vs. WebCodecs, Chrome/Safari/Firefox, Referenzhardware | Größtes technisches Risiko; entscheidet Codec-Strategie und P1 | 1.5 (Prototyp genügt) | S–M | Grundlage für P1/P3/P4 |
| 1.7 | Output-Fenster: Steuer- und Projektorfenster, BroadcastChannel-Replikation, `getScreenDetails`, Wake Lock, Hot-Plug | Operator-UI und Output trennen (AVVX-Nutzer forderten das schon 2014) | 1.1, 1.2 | M | Alle; R2 |

### Phase 2: VJ-Kern (ca. 4–6 Monate)

| # | Arbeitspaket | Begründung | Abhängig von | Aufwand | Schließt Lücke zu |
|---|---|---|---|---|---|
| 2.1 | Clip-Launcher (Layer × Spalten), Trigger normal/piano, Spalten-Trigger, Preload/Arm | Mentales Modell aller VJs; R7 | 1.3, 1.5 | L | Resolume, SonomikaTD |
| 2.2 | Master-Clock, Transport, Tap-BPM, Beat Snap | Beat-quantisierter Start ist Pflicht | 2.1 | M | Resolume Beat Snap |
| 2.3 | Transitions und A/B-Crossfader, Transition pro Clip | Pflicht; Resolume seit 7.25 pro Clip | 1.5, 2.1 | M | Resolume, VDMX Two Channel Mixer |
| 2.4 | Effektsystem auf ISF v2: Effektstapel pro Clip/Layer/Komposition, 30–50 gebündelte Effekte und Generatoren unter permissiver Lizenz | Von 8 CSS-Filtern zu Pflichtniveau; ISF ist der Interop-Standard | 1.5 | L | VDMX, Synesthesia, Resolume Wire |
| 2.5 | Modulation: LFO, Hüllkurve, FFT L/M/H mit Gain/Decay (AnalyserNode, AudioWorklet), Live-BPM, Dashboard-Makros | Audioreaktivität ist Pflicht | 2.2 | M | Resolume Dashboard, Synesthesia |
| 2.6 | Web MIDI Learn mit LED-Feedback, getestete Templates (APC mini mk2, APC40 mkII, Launchpad, Midi Fighter Twister, nanoKONTROL2), volle Tastatur-Parität | Ohne Controller kein VJing; Template-Mangel ist belegter Schmerzpunkt | 2.1 | M | Resolume (nur wenige Presets) |
| 2.7 | Live-Inputs: Kamera und Capture-Karte (`getUserMedia`), Fenster/Bildschirm (`getDisplayMedia`) | Pflicht | 1.5 | S–M | Alle VJ-Tools |
| 2.8 | Aufnahme des Outputs (`captureStream` + MediaRecorder bzw. WebCodecs + Mediabunny) | Pflicht; Synesthesia hat keinen Recorder | 1.5 | M | Resolume, VDMX |
| 2.9 | WebCodecs-Engine für frame-genaue Clips (Scrubbing, Rückwärts, BPM-Loops) | Je nach Ergebnis von 1.6 | 1.6, 2.2 | L | HAP/DXV-Bedienkomfort |

### Phase 3: Mapping-Pro (ca. 3–4 Monate, überlappend mit Phase 2)

| # | Arbeitspaket | Begründung | Abhängig von | Aufwand | Schließt Lücke zu |
|---|---|---|---|---|---|
| 3.1 | Screens/Slices: Komposition → N Screens → Slices mit Input Selection und Output Transformation; „Match Input/Output Shape" | Kernarchitektur aller reifen Mapper | 1.5, 1.7 | L | Resolume Advanced Output, HeavyM Screens |
| 3.2 | Mesh-Warp N×M linear/Bezier innerhalb des Corner-Pins, Umschalter Perspective/Bilinear | Größte Mapping-Lücke | 1.5 | L | MadMapper, Millumin, WATCHOUT |
| 3.3 | Optionaler stückweise affiner „Linear"-Polygonwarp per Triangulierung | Fix C für Nutzer, die Vertices direkt ziehen | 3.2 | M | Resolume-Poly-Slices, MapMap |
| 3.4 | Output-Space-Masken, Masken-„attach to" (Fläche/Input/Output), Bezier-Kanten, Feather entlang der Form | Behebt Masken-Raum-Verwirrung | 1.5 | M | MadMapper 4.0, WATCHOUT |
| 3.5 | Edge-Blending (Breite, Power, Luminanz, Gamma RGB, Schwarzwertkompensation), Auto-Overlap, Farbkorrektur pro Output, Testbild mit Diagonalen | Pflicht für Multi-Projektor | 3.1 | M | Resolume, WATCHOUT, MadMapper 6.2 |
| 3.6 | Quick Wins: Lock pro Layer/Slice, Kanten-Handles, numerischer Warp, Cursor-Koordinaten, SVG-Import/-Export | Belegte Nutzerwünsche, günstig | 0.3 | je S | Resolume-Lock-Wunsch, MadMapper-Wunschliste, Millumin-SVG |
| 3.7 | Virtuelle Screens und Screen-zu-Screen-Routing | Mehrstufiges Warpen, Substrat für LED | 3.1 | M | Resolume Slice Routing, WATCHOUT Virtual Displays |

### Phase 4: Show-Control und Integrationen (ca. 4–6 Monate)

| # | Arbeitspaket | Begründung | Abhängig von | Aufwand | Schließt Lücke zu |
|---|---|---|---|---|---|
| 4.1 | Show-Modus mit PIN-Sperre, Panik-Controls, Preflight, Performance-HUD, Diagnose-Bundle | R4, R5, R6, R10 | 1.7, 2.1 | M | Smode-Lock, Resolume-Panik; Lücke bei allen |
| 4.2 | Cue-Liste/Timeline mit „alle Layer cuen" und HH:MM:SS:FF-Eingabe | Belegter Event-AV-Wunsch; das Drittanbieter-Tool [TC-Off](https://tombass.gumroad.com/l/tc-off) existiert nur, um Timecode-Offsets in Resolume massenhaft zu ändern | 2.2 | L | Resolume-SMPTE-Schwäche, Millumin |
| 4.3 | REST/WebSocket-API nach Resolume-Vorbild (subscribe/set/get/trigger); Handy-Remote per QR | Web-nativer Vorteil; Resolume brauchte bis 7.8 | 1.2 | M | Resolume REST, Ghost-Arcade-Companion |
| 4.4 | Companion-Bridge bzw. Electron-Main: OSC, Art-Net/sACN, Ableton Link, MIDI für Safari | Browser hat kein UDP | 4.3 | L | Alle Pro-Tools |
| 4.5 | Electron-Pro-Build: native Fenster pro Display, Autostart, Kiosk, Syphon/Spout per `sharedTexture`, NDI | Multi-Projektor ohne Gesten, Interop | 1.5, 1.7 | L–XL | Resolume Arena, MadMapper |
| 4.6 | Timecode: MTC über Web MIDI, LTC aus Audio dekodiert | Event-AV-Pflicht; Machbarkeit noch zu prüfen | 4.2 | M | Resolume Arena, VDMX, Millumin |
| 4.7 | Installationsmodus: Autostart in letzte Show, erster Cue beim Laden, ICS-Zeitplan, Health-Endpoint, Output-Snapshot | Segment Installationen | 4.3, 4.5 | M | MadMapper Calendar Scheduler, HeavyM Pro+ |
| 4.8 | Redundanz: Zustandsspiegelung an Backup-Instanz im LAN | R8; heute überall DIY | 4.3 | L | WATCHOUT, Millumin (Chataigne) |
| 4.9 | LED-Fixtures: Fixture-Editor (Grid, Farbreihenfolge, Zickzack, Gamma, Universen), Sampling aus der Komposition, Ausgabe über Bridge oder Web Serial | Mid-Tier-Standard | 3.7, 4.4 | L | Resolume Lumiverses, MadMapper |

### Phase 5: Differenzierer (laufend, ab etwa Monat 12)

| # | Arbeitspaket | Begründung | Abhängig von | Aufwand | Schließt Lücke zu |
|---|---|---|---|---|---|
| 5.1 | Echtzeit-Co-Editing eines Mappings vor Ort (eine Person am Projektor, eine am Laptop) | Web-einzigartig; disguise nennt Multi-User nur als Roadmap | 1.2, 4.3 | XL | disguise Mapping Matter |
| 5.2 | HAP-Decoder (WASM-Snappy, BC-Texturen), nur Desktop | Kein Browser-HAP existiert | 1.5, 1.6 | L | HAP-Hosts |
| 5.3 | Shadertoy-Import mit Lizenzwarnung, MilkDrop-Presets über Butterchurn | Content-Breite, O3 | 2.4 | M | Synesthesia, Stims |
| 5.4 | MCP-Endpunkt für KI-gestützten Kompositionsaufbau | Präzedenz Resolume 7.26, MapMap dev | 4.3 | M | Resolume |
| 5.5 | CV-Effekte (Segmentierung, Tiefe, Tracking) mit MediaPipe oder ONNX-Web | Wird 2025–26 vom Differenzierer zur Erwartung | 2.4 | M | Resolume 7.28, VDMX |
| 5.6 | MPCDI-Import, Import/Export von Resolume-Advanced-Output-XML | Interop, Ökosystem existiert (ROAGEN, UnMapper) | 3.1 | M | WATCHOUT, VIOSO |
| 5.7 | 3D-Mapping: OBJ/glTF und Projektorpose aus ≥6 Punktpaaren (opencv.js) | Gängiger nächster Schritt nach Corner-Pin | 1.5, 3.1 | XL | MadMapper, Millumin, WATCHOUT |
| 5.8 | Webcam-Structured-Light-Kalibrierung (Gray-Code) | Nativ nur bei disguise; spekulativ | 5.7 | XL | disguise OmniCal |

Drei Dinge sollte das Team bewusst **nicht** tun. Es sollte nach Phase 0 keine weiteren Features in den CSS-Renderer stecken, denn jede Zeile dort ist Wegwerfcode. Es sollte HAP nicht vor dem Benchmark-Spike angehen, weil erst 1.6 zeigt, ob All-Intra-H.264 über WebCodecs reicht. Und es sollte keine Multi-Projektor-Parität in Safari oder Firefox anstreben, weil dort die APIs fehlen.

## Fazit

Die wichtigste Verschiebung im Verständnis betrifft den Corner-Pin: Der „Bug" ist kein Konzeptfehler, sondern eine unvollständige Umsetzung des richtigen Konzepts. Weil keiner der großen Wettbewerber echte Perspektive auf beliebigen Formen bietet (Resolume lehnt sie für Polygone ausdrücklich ab), kann eine konsequente Photoshop-Hülle mit inverser Homographie den Video-Mapper schon nach Phase 0 in einem Punkt vor Resolume bringen. Das ist der richtige Anfang, aber kein Geschäftsmodell. Geometrie ist Commodity, und die eigentliche Arbeit liegt darunter: im Szenenmodell, das Stage und Show trennt und Clips statt einzelner Medien kennt, und im GPU-Renderer, an dem fast jede weitere Pflichtfunktion hängt. Wer diese beiden Fundamente in Phase 1 sauber legt, baut die VJ- und Mapping-Features danach linear statt doppelt.

Strategisch liegt der Vorteil nicht dort, wo Desktop-Tools stark sind (Layerzahl, Codecs, native I/O), sondern dort, wo sie seit Jahren schwach sind und ein Web-Stack nahezu gratis glänzt: Autosave mit Versionshistorie und Crash-Recovery, Handy-Remote und API, Plattformfreiheit bis zu Linux und Chromebook, Lizenzen pro Person und Show-Pässe. Das größte offene Risiko ist messbar und sollte zuerst gemessen werden: wie viele Videolayer ein Browser auf Referenzhardware stabil mit 60 fps trägt. Fällt der Benchmark aus Phase 1 gut aus, ist ein produktionsreifes Werkzeug für Einsteiger-VJs, Einstiegs-Mapping und Bildung nach grober Schätzung in zwölf bis 15 Monaten realistisch. Fällt er schwach aus, verschiebt sich der Schwerpunkt früher auf den Electron-Build und HAP.
