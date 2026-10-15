# Production-Readiness Requirements, User Needs & Market Landscape for a Browser-Based VJ / Projection-Mapping Tool (as of Oct 2026)

> Research method note: Reddit (reddit.com) is blocked for both search and fetch from this research environment, and resolume.com/forum returns HTTP 403 to direct fetches. Practitioner statements from those sources come from search-result excerpts or Reddit mirror front-ends (redlib/libreddit instances). They are flagged "(excerpt)" where the page itself could not be opened. Many Resolume forum threads have no date visible in the excerpts; the approximate era is given where the excerpt makes it inferable (e.g., software version mentioned). Vendor pages (resolume.com/shop, madmapper.com, millumin.com, docs.dataton.com, help.millumin.com, docs.vidvox.net) were fetched directly on 2026-10-15.

## 1. Reliability & show safety: feared failures and pro-tool safeguards

### Takeaway
Practitioners mostly fear three things: whole-app crashes (often traced to GPU drivers, MIDI clock, plugins or USB hubs), outputs silently dropping or blinking when displays reconnect, and hitches or stutter when a clip is triggered. Pro tools respond with layered safeguards rather than one feature: hardware or software redundancy with a video switcher, automatic failover in high-end servers, guarded quitting and UI locks, a one-keystroke way to kill all outputs, autostart for installations, and offline-tolerant licensing. Disciplined operational prep (no updates before a show, a stripped-down OS, a bootable clone) is treated as part of the product experience.

### Cited Findings
**Failures practitioners report**
- Mid-show crash causes discussed on the Resolume forum (excerpts): (1) In a 2024 thread, crashes were attributed to NVIDIA drivers, and staff asked whether a display had been disconnected. A driver update stopped the crashes, but the output "still blinked". (2) The same poster suspected a USB hub, heavy effects and third-party plugins. They proposed splitting VJing and mapping across two PCs linked by NDI, calling the VJ machine "the most fragile part". — [Resolume forum p=98759](https://resolume.com/forum/viewtopic.php?p=98759); [p=98717](https://resolume.com/forum/viewtopic.php?p=98717)
- In an older thread (Resolume 4.x era, roughly 2012), a "First VJ Gig...! Complete nightmare" crash was suspected to come from the MIDI-clock setting. A user suggested tap tempo instead, and Resolume promised MIDI-clock handling improvements in 4.1.4 (excerpt). — [Resolume forum p=40070](https://www.resolume.com/forum/viewtopic.php?p=40070)
- Outputs go black while the preview keeps playing. Reselecting the output temporarily fixes it, and staff asked: "Is the machine losing connection to the display by any chance?" (Windows 8.1, two VGA projectors; excerpt). — [Resolume forum p=80786](https://www.resolume.com/forum/viewtopic.php?p=80786)
- Multi-projector setup trouble: staff suggested 100% Windows display scaling on every display, but only a restart helped (excerpt). — [Resolume forum p=67576](https://resolume.com/forum/viewtopic.php?p=67576)
- Stutter on clip trigger: one user saw the playing clip stutter when a new clip was selected with a transition. They noted that "other media servers preload the opening second or so of clips into buffers" and could not find such a feature in Resolume. A reply explained that starting H.264 decoding requires seeking back to a keyframe, whereas "with DXV you can just jump to the position and decode", and said pre-buffering every possible clip in RAM is impractical for a VJ app (2009–2022 threads; excerpt). — [Resolume forum p=21325](https://www.resolume.com/forum/viewtopic.php?p=21325); [p=64508](https://resolume.com/forum/viewtopic.php?p=64508)
- "Output freezes for 1/2 second when triggering clips or preview" after clips sat idle for about a minute (DXV3, Resolume 6.1.5, about 2019). Staff pointed to power settings and disk sleep (excerpt). — [Resolume forum p=88508](https://resolume.com/forum/viewtopic.php?p=88508)
- Playback freezes were blamed on background tasks such as Defender scans or OneDrive sync. Users recommend high-performance power plans and disabling disk, USB and device sleep, and suspect CPU core power-saving causes lags (excerpt). — [Resolume forum p=94609](https://resolume.com/forum/viewtopic.php?p=94609); NVIDIA "Prefer Max Performance": [p=58807](https://resolume.com/forum/viewtopic.php?p=58807)
- Crash diagnosis: Resolume staff routinely ask for crash logs. Some users cannot find them, and one reported Windows event logs had "nothing useful" (excerpt). — [Resolume forum "Resolume Crashing" p=81124](https://www.resolume.com/forum/viewtopic.php?p=81124); [p=97603](https://www.resolume.com/forum/viewtopic.php?p=97603)
- Millumin: an older thread links crashes to heavy media across many boards and layers, and the developer's first suggestion was "an external and fast harddrive" (excerpt). — [Millumin forum comment 187](https://forum.millumin.com/discussion/comment/187/); [comment 193](https://forum.millumin.com/discussion/comment/193)
- Millumin: a show opened on a laptop with no outputs connected fills the laptop screen in full-screen mode. Users had to press CMD-F to escape (excerpt). — [Millumin forum comment 6412](https://forum.millumin.com/discussion/comment/6412)
- Media lost on handover: a user copying a show to a backup Mac reported "some files are lost" after saving (excerpt). — [Millumin forum comment 5264](https://forum.millumin.com/discussion/comment/5264/)
- OS notifications on output: macOS can turn on Do Not Disturb automatically "when mirroring to TVs and projectors", but this does not cover extended external monitors, which is the typical VJ setup. — [The Sweet Setup](https://thesweetsetup.com/how-to-fine-tune-do-not-disturb-on-your-mac/); [iMore](https://www.imore.com/how-set-and-use-do-not-disturb-mac). Windows Focus Assist can turn on automatically when duplicating a display. — [Popular Science](https://www.popsci.com/control-computer-notifications/). (No VJ-specific thread about notifications appearing on projector output was found.)
- Installations: an exhibit builder set players to autostart and cut power nightly. Repeated power-offs corrupted media, so loops stalled. The fix was to keep players running and switch off only the projectors. — [TroikaTronix forum post 47113](https://community.troikatronix.com/post/47113); [post 48817](https://community.troikatronix.com/post/48817)

**Safeguards in pro tools (vendor documentation)**
- Resolume Preferences: "Quit Confirmation" (when disabled, Resolume shuts down immediately on Ctrl/Cmd+Q). For fixed installations, the docs suggest disabling it together with Layer > "Trigger First Clip when Composition Has Loaded". "Clip Start Offset" compensates for "delays with MIDI triggering and/or long cable runs". DMA Textures should be forced ON, and Autodetect "fails to detect the correct setting in a lot of cases". — [Resolume Preferences manual](https://resolume.com/support/en/preferences)
- Resolume panic: Cmd/Ctrl + Shift + D disables all outputs (staff reply). — [Resolume forum p=98177](https://resolume.com/forum/viewtopic.php?p=98177)
- Resolume "Preparing Media": the best setup is "a separate OS installation with only the bare minimum of software, booted only for performances". Firewalls, virus checkers and desktop utilities are not needed during a performance, and users should not install codec packs such as K-Lite. — [Resolume article 41](https://resolume.com/article/41)
- Resolume licensing: one license covers one computer plus a backup machine at a time (reseller statement). — [audioeffetti reseller listing](https://audioeffetti.com/en/category/video/media-servers/resolume-arena7x1-resolume-arena-7-for-1-computer-p8521). A two-computer license covers "2 machines + 1 backup at a time" (forum, Resolume 6 era). — [Resolume forum p=66611](https://www.resolume.com/forum/viewtopic.php?p=66611)
- Millumin backup machine (official tutorial): the main machine sends OSC on every column launch, Chataigne relays it, and the backup launches the same column. Both machines feed a hardware video switcher: "If a problem happens, you would just have to use your video-switcher, to change the source to display on stage." Only column launches are mirrored, not live tweaks. — [Millumin help: setup a backup machine](https://help.millumin.com/v4/tutorials/setup-a-backup-machine/)
- Millumin's developer said "automatic syncing of the backup machine" is the more useful goal than locking OSC settings (excerpt). — [Millumin forum comment 4391](https://forum.millumin.com/discussion/comment/4391/)
- Millumin V5 marketing lists "Silent Edition", which lets you edit a running show "Without the audience noticing it", and "Auto States". — [millumin.com](https://millumin.com/)
- Smode has a "User Interface Lock" with an optional password. — [Smode docs](https://www.smode.io/documentation/ref/ui/user-interface-lock.htm)
- Dataton WATCHOUT 7: if two machines share the same alias, "the system automatically switches to the backup machine within seconds" when the active machine goes offline. Caveats: WATCHOUT "will use whichever one it discovers first", and duplicate aliases should be used "only for intentional failover". — [WATCHOUT 7 Network Overview](https://docs.dataton.com/watchout-7-new/watchout/network-setup/network-overview.html)
- WATCHOUT practitioners note that backup machines can drift out of sync, so backup outputs are kept shuttered, advanced manually, or triggered over DMX/Art-Net. Staff recommend a second tier plus a matrix switcher for smaller shows. — [Dataton forum topic 943](https://forum.dataton.com/topic/943-best-practice-for-redundant-show-playback-aka-backup/)
- disguise: the D3NetManager API exposes "understudies", an understudy status and an automatic failover timeout (0 = disabled). OSC Machine Control has failover and restore addresses. disguise markets "automatic redundancy failover if hardware fails". The software-only Designer cannot run a show as a Director. — [D3NetManager](https://developer.disguise.one/plugins/docs/d3netmanager); [OscMachineControl](https://developer.disguise.one/plugins/docs/oscmachinecontrol); [disguise ISE 2026 one-pager](https://www.disguise.one/sites/default/files/2026-01/ISE%20One%20Pager%20%E2%80%93%20Live%20Entertainment.pdf); [Designer overview](https://legacy-help.disguise.one/en/Content/Fundamentals/Designer/Designer-overview.html)

**Practitioner operational discipline**
- VIDVOX VV-Edu "Getting Gig Ready": "do not, I repeat, do not update any of your software or operating system the day, or night before your event". "The golden rule of computers: if it's not broke, don't update it." Make a bootable duplicate of the show drive (Carbon Copy Cloner), keep a separate USB media backup and cloud backups, "make sure your phone can act as a hotspot", register all software before the event, and test "every cable and software cue". It also asks whether you can run visuals without your MIDI controller. — [VIDVOX handout 6.3](https://docs.vidvox.net/vv-edu/handout_module_6_3)
- r/vjing "Plan B for a VJ" (about 2025, via mirror; excerpt): advice included a second laptop plus an external drive with the media, a hardware video switcher or T-bar as fallback, and a laptop-to-HDMI pre-recorded set as last resort. — [r/vjing mirror](https://lr.us.psf.lt/r/vjing/comments/1kyaww5/plan_b_for_a_vj)

### Inferences
Proposed testable production-readiness criteria. These are derived from the findings above; the thresholds are the researcher's proposals, not industry standards.
- **R1 Soak stability:** at least 8 h continuous playback at reference load (for example 4 layers plus effects, mapped to 2 outputs) with 0 crashes, 0 output-window exits and no unbounded memory growth (heap/VRAM slope ≈ 0 after warm-up). A 72 h variant applies for the installation tier.
- **R2 Output resilience:** after a display unplug/replug, a resolution change or GPU context loss, output returns to the assigned display in full screen without operator action within 5 s, and the event is logged. This addresses the "outputs go black / blink" reports.
- **R3 Crash and reload recovery:** autosave at least every 30 s plus on every structural edit. After a crash or tab reload, the full show state (mapping, warps, layer and clip assignments, MIDI map) is restored. Option to auto-trigger the first clip or cue on load, mirroring Resolume's installation recipe.
- **R4 Show/lock mode:** disables destructive edits, guards quit/close and navigation, and requires a deliberate unlock (optional PIN, as in Smode). Output keeps running while the UI is edited ("silent edit", as in Millumin).
- **R5 Panic controls:** one key and one MIDI-mappable control each for blackout, freeze-last-frame and fallback (safe still/loop), each reaching output within 1 frame. Precedent: Resolume Ctrl+Shift+D.
- **R6 Pre-show preflight:** detects missing or unplayable media, codec/decoder support, insufficient VRAM, OS Do-Not-Disturb off, power-saving or sleep enabled, and a missing MIDI device. Shows a go/no-go checklist.
- **R7 Trigger without hitch:** triggering or cueing a new clip causes 0 dropped frames on other layers. Preloaded clips start within 1 output frame; cold clips start within 100 ms. Clips can be preloaded explicitly ("arm/cue").
- **R8 Redundancy:** show state can be mirrored to a second machine or browser instance over LAN (cue/column launches at minimum, ideally full state). This allows hardware-switcher failover as in Millumin, WATCHOUT and disguise.
- **R9 Offline:** after initial load and license activation, everything (UI, media, shaders, licensing) works with no network for at least 30 days. The Resolume precedent is a 30-day phone-home.
- **R10 Diagnosability:** an operator-visible frame-time/dropped-frame meter and an exportable local log bundle. This addresses the "can't find crash logs" pain.

### Gaps
- No quantitative failure-frequency data (for example "x% of gigs have a crash") was found. Evidence is anecdotal.
- No VJ-specific source documents OS notifications actually appearing on projector output. Only generic OS Do-Not-Disturb behavior was sourced.
- No official Resolume documentation on autosave or crash recovery was found. Whether Resolume autosaves compositions is unverified.
- Reddit threads (r/vjing, r/projectionmapping) could not be accessed directly, so practitioner coverage relies on mirrors and the vendor forums.

## 2. Performance expectations & benchmarking

### Takeaway
Professional expectations center on a locked frame rate (60 fps standard; 30 fps acceptable for some 4K playback) with multiple simultaneous HD layers. GPU-decoded intra-frame codecs (HAP/DXV, NotchLC) are used precisely to make layer count and instant triggering possible. Rigs are benchmarked empirically, with vendor benchmark files and per-codec layer-count tables, not synthetic scores.

### Cited Findings
- Resolume: DXV is "by far the fastest codec because Resolume can decompress the video frames on the GPU instead of the CPU". Codec choice sets per-frame CPU time and therefore how many smooth layers and effects are possible. — [Resolume article 41](https://resolume.com/article/41)
- Resolume forum: the recommended capacity test is to "download the 4K benchmark Part 1 & Part 2 and test your system". DXV3 moves decompression to the GPU (excerpt). — [Resolume forum p=53186](https://www.resolume.com/forum/viewtopic.php?p=53186)
- disguise per-codec layer tables (dedicated media servers, so an upper bound): EX 3 at 4K DCI handles HAP 15 layers at 30 fps and 8 at 60 fps, and HAPQ 8 and 4. At 1080p, EX 3 handles HAP 34 layers at 30 fps and 30 at 60 fps, ahead of NotchLC and ProRes. EX 2 at 4K handles HAP 21/16, and VX 3 at 4K handles 25/13. — [disguise EX 3 performance](https://help.disguise.one/hardware/performance/ex3-performance); [EX 2](https://help.disguise.one/hardware/performance/ex2-performance); [VX 3](https://download.disguise.one/hardware/performance/vx3-performance); [codec metrics](https://download.disguise.one/hardware/performance/video-playback-performance-metrics)
- Storage: forum users say spinning drives "will always cause this [stutter] with modern resolutions" and recommend SSDs. Re-exporting DXV with the latest codec version fixed stutter for one user (excerpts). — [Resolume forum p=21325](https://www.resolume.com/forum/viewtopic.php?p=21325); [p=64508](https://resolume.com/forum/viewtopic.php?p=64508)
- Millumin V5 markets multiple displays "up to 16K" at 8- or 10-bit depth, and says "Your computer is the limit". — [millumin.com](https://millumin.com/)
- Audio-to-video timing: ITU-R BT.1359 detectability thresholds are +45 ms (audio leads) to −125 ms (audio lags). Acceptability is about +90 to −185 ms. ATSC is stricter at +15/−45 ms. — [Wikipedia: Audio-to-video synchronization](https://en.wikipedia.org/wiki/Audio-to-video_synchronization); [TV Technology](https://www.tvtechnology.com/opinions/av-synchronization-how-bad-is-bad)
- Resolume's audio buffer guidance says 512 or 1024 samples is "usually safe", and smaller buffers may glitch. Clip Start Offset exists to compensate for MIDI and cable latency. — [Resolume Preferences](https://resolume.com/support/en/preferences)
- Loop and BPM precision: at PAL 25 fps, a one-bar loop at 90 BPM cannot loop perfectly (the closest is 66 frames, about 90.9 BPM). Resolume therefore advises keeping audio separate and uncompressed (PCM WAV, 44.1 kHz/16-bit). — [Resolume article 41](https://resolume.com/article/41)

### Inferences
- **P1 (frame budget):** sustain 60 fps (p99 frame time ≤ 16.7 ms, fewer than 1 dropped frame per 10 min) at 1080p output with at least 4 concurrent 1080p video layers plus 2 effects plus mapping, on a defined mid-range reference machine (for example an Apple M-series or RTX-class laptop). A 4K30 mode is "supported" and 4K60 "best effort". Dedicated servers manage 30+ HAP layers at 1080p, so a browser tool will compete on accessibility, not layer count.
- **P2 (latency):** controller-to-photon latency of at most 2 frames (≤ 33 ms at 60 fps) for preloaded clips. This keeps visual hits inside the +45 ms detectability window relative to the music.
- **P3 (codec strategy):** browsers cannot rely on HAP/DXV hardware paths. Intra-frame-friendly delivery (short GOP or all-intra H.264/VP9/AV1 via WebCodecs, or image sequences) plus explicit preloading are needed to avoid the keyframe-seek stutter described for H.264.
- **P4 (benchmarking):** ship an in-app benchmark scene (N layers × resolution × codec) that reports max stable layers and dropped frames. This mirrors Resolume's benchmark files and disguise's codec tables, and VJs expect to test their own rig this way.

### Gaps
- No source gives a community-standard "minimum layers" number for club VJing. The 4-layer target above is an inference.
- No published latency benchmark (MIDI-to-output) was found for Resolume, MadMapper or others.
- Browser-specific decoding performance (WebCodecs, WebGPU) was out of scope for this note and should be covered by technical research.

## 3. Workflow needs by segment

### Takeaway
Each segment needs a different "core loop". Club VJs need instant clip and effect triggering, BPM sync and MIDI. Mapping artists need precise warping, edge blending, multi-output and previsualization. Event AV needs timecode, cue lists and redundancy. Installations need autostart, scheduling, unattended operation and offline licensing. Hobbyists, education and churches need low price, easy onboarding and template workflows. Vendors split products and prices along exactly these lines (Avenue/Arena, HeavyM Live/Pro/Pro+, MadMapper rental for "temporary installations").

### Cited Findings
**(a) Club/festival VJ**
- Resolume pitches BPM sync ("Synchronise to the BPM"), FFT audio analysis, NDI, Syphon/Spout and capture cards. Avenue (€299) is the performance product, and Arena (€799) adds projection mapping, edge blending and DMX in/out. — [Resolume Avenue vs Arena](https://resolume.com/software/avenue-arena)
- In an r/vjing thread (27 Jul 2024, via mirror; excerpt), Resolume is "beginner friendly and gets you going fast but expensive". TouchDesigner "takes long to learn but is free" (resolution-limited non-commercial license). Synesthesia "handles audio reactive shaders very well and gives you a lot of great preset looks". VDMX is "sort of like a DJ mixer for video sources". — [r/vjing "getting into vjing" (redlib mirror)](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing) (mirror domain now offline; content from search excerpt)

**(b) Projection-mapping artist**
- Resolume Arena's projection mapping section includes edge blending for multi-projector setups. — [Resolume Avenue vs Arena](https://resolume.com/software/avenue-arena)
- disguise's "Mapping Matter" is a browser-based 3D previsualization and planning tool for complex projection projects. The listing describes live multi-user editing as upcoming. — [disguise ISE 2026 Mapping Matter one-pager](https://www.disguise.one/sites/default/files/2026-01/ISE%20One%20Pager%20%E2%80%93%20Mapping%20Matter.pdf) (via search excerpt)
- MadMapper tutorials: connect at least one projector before opening the app, set displays to "extend" not "mirror", and toggle full screen with cmd+U. Full screen is also OSC-controllable via `/application/view/fullscreen`. — [MadMapper OSC commands](https://docs.madmapper.com/madmapper/6/11.-live-performance-and-control/osc-commands-and-channels-list); [UAL Creative Technology Lab](https://lab.arts.ac.uk/books/projection-mapping/page/projection-mapping-in-madmapper/revisions/4161)
- Millumin V5 supports multiple displays up to 16K and laser output. — [millumin.com](https://millumin.com/)

**(c) Event AV / corporate (and churches)**
- Resolume: "SMPTE Input is available on Resolume Arena only". Arena can listen to two SMPTE inputs and lock a clip's playhead to timecode. — [Resolume article 46](https://resolume.com/article/46)
- Pain: Arena jumps to a different point on each SMPTE receipt, with drift of 15 frames to 3 s. Clips only follow timecode if each is set to SMPTE transport individually. A user asked for one entry to cue all layers to the same point and start together, and for HH:MM:SS:FF entry. No built-in cue list was offered (excerpts). — [Resolume forum p=88760](https://resolume.com/forum/viewtopic.php?p=88760); [p=79463](https://www.resolume.com/forum/viewtopic.php?p=79463); [p=45732](https://www.resolume.com/forum/viewtopic.php?p=45732)
- A third-party commercial tool (TC-Off) exists only to bulk-edit timecode offsets across large Resolume compositions. This signals an unmet workflow need. — [TC-Off on Gumroad](https://tombass.gumroad.com/l/tc-off)
- Church production staff maintain an internal runbook for "Resolume Arena not seeing SMPTE Timecode" (Elevation Church). Its first steps are restarting Arena and then the computer. — [Elevation Church support article](https://staff.elevationchurch.org/support/solutions/articles/18000007593)
- QLab, the theater/event cue-list standard, sells perpetual licenses, daily rentals and volume licenses for large installations. — [Wikipedia: QLab](https://en.wikipedia.org/wiki/QLab)
- WATCHOUT and disguise provide automatic failover (see section 1). Redundancy is an expectation in this segment. — [WATCHOUT 7 docs](https://docs.dataton.com/watchout-7-new/watchout/network-setup/network-overview.html)

**(d) Permanent installations / museums**
- Resolume's recommended installation recipe is to disable Quit Confirmation and enable "Trigger First Clip when Composition Has Loaded". — [Resolume Preferences](https://resolume.com/support/en/preferences)
- Resolume: "many people run Resolume in fixed art installations without internet access". Offline registration and a hardware dongle are offered, and offline machines must "phone home every 30 days". — [Resolume article 28](https://resolume.com/article/28); [Resolume registering (v6)](https://resolume.com/support/en/6/registering)
- MadMapper sells a rental tier explicitly labeled "Temporary installations: From 49€/month excl tax". — [MadMapper MadBundle](https://www.madmapper.com/madbundle)
- HeavyM Pro+ adds "permanent-installation features" and video export (excerpt). — [HeavyM pricing](https://www.heavym.net/pricing)
- Museum AV practice: for timed playback, BrightSign players are the usual recommendation, and "the cheapest models should be enough" for basic scheduling. Consumer players "don't auto-start after a power loss". One installer ran Micca Speck G2 units for 14 weeks without disruption. Raspberry Pi is a common museum media-server choice. — [AAM Open Forum](https://community.aam-us.org/question/recommendations-for-a-media-player-on-timer); [TroikaTronix post 48817](https://community.troikatronix.com/post/48817); [post 47115](https://community.troikatronix.com/post/47115); [ProSoundWeb forum](https://forums.prosoundweb.com/index.php/topic,175124.0.html)
- Videotel's VP71 is marketed as running from SD/USB "without monitoring". A Nevada State Museum exhibits manager said it reduced maintenance. — [AV Network](https://www.avnetwork.com/news/videotel-digital-signage-for-nevada-state-museum)

**(e) Hobbyists / education / small venues**
- HeavyM is tiered: Live is limited to one video output, Pro adds unlimited outputs, a timeline and NDI/OSC/DMX, and Pro+ adds export and installation features. It offers rent-to-own (owned after 6 months) or a one-time purchase with 1 year of updates (excerpt). — [HeavyM pricing](https://www.heavym.net/pricing); [HeavyM upgrades](https://www.heavym.net/updates_upgrades/)
- Education discounts are universal. Resolume gives 50% off for students, teachers and institutions. Millumin gives 50% off lifetime (199€/US$249 vs 399€/US$499) and offers a 1-year educational license at 15€/US$19. TouchDesigner Educational costs $300. — [Resolume shop](https://resolume.com/shop); [Millumin educational](https://millumin.com/educational); [TouchDesigner Educational](https://derivative.ca/UserGuide/TouchDesigner_Educational)
- Browser-native, low-cost entrants exist. 4mapper ("Projection mapping in your browser. No installation needed.") offers corner-pin perspective, multi-scene and MP4/WebM/GIF, with a free tier and a PRO tier with 5 GB of cloud storage. AlternativeTo lists $39 one-time. It had minimal traction on Product Hunt (1 upvote). — [Product Hunt: 4mapper](https://www.producthunt.com/products/4mapper-web-based-projection-mapping); [AlternativeTo: 4mapper](https://alternativeto.net/software/4mapper/about)
- cables.gl, a browser-based node-based visual programming tool, became MIT open source with offline standalone builds in Aug 2024. Builds exist for macOS, Windows and Linux (AppImage), and v0.7.0 shipped on 7 Jul 2025. — [CDM Aug 2024](https://cdm.link/2024/08/cables-gl-open-offline/); [cables.gl downloads](https://cables.gl/downloads); [CDM June 2025](https://cdm.link/cables-june-2025/)

### Inferences
- A browser tool can credibly target (a) club VJs, (b) entry and mid-level mapping, and (e) hobby/edu/church first. Segments (c) and (d) require timecode, cue lists, redundancy, autostart and unattended operation, which are harder to guarantee in a browser sandbox. They make good tier-2 targets ("Pro/Install" tier) once R1–R10 are met.
- Recurring unmet needs that are realistic differentiators are: a real cue list with timecode-based "cue all layers" and HH:MM:SS:FF entry; built-in preloading and arming of clips; and built-in backup-machine sync instead of third-party OSC relays (Chataigne).
- An installation mode should include autostart into the last show, auto-full-screen on the assigned display, a daily schedule (on/off/playlist), recovery after power loss, and remote health status. Museums currently use signage players for exactly this.

### Gaps
- No quantitative split of users by segment (club vs mapping vs corporate vs installation) was found.
- No source covered scheduling or remote-monitoring features of Resolume, MadMapper or Millumin in detail. These would need vendor manuals.
- Multi-projector auto-calibration (camera-based alignment, as in MadMapper or disguise OmniCal) was not researched in depth.

## 4. Pain points & feature requests about existing tools

### Takeaway
The dominant complaints are price (especially Arena at €799, Pro tiers, and multi-seat costs), learning curve (TouchDesigner in particular), OS lock-in (Millumin and VDMX macOS-only; no Linux from Resolume, MadMapper or Millumin), per-machine licensing friction (moving licenses, offline unregistering), and missing pro workflow pieces (preloading, cue lists, timecode convenience, backup sync). Users explicitly asked Resolume for rental licensing "like QLab".

### Cited Findings
- Price: Resolume is "beginner friendly and gets you going fast but expensive" (r/vjing, 27 Jul 2024, mirror excerpt). — [r/vjing mirror](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing). CDM notes Black Friday or anniversary sales are "the only week of the year" some VJ tools are discounted, and Resolume once ran 50% off for its 10th anniversary. — [CDM Cyber Monday 2021](https://cdm.link/2021/11/the-best-deals-for-creative-and-live-visual-software-you-can-still-get-on-cyber-monday/); [CDM Resolume turns 10](https://cdm.link/resolume-vj-av-software-turns-10-with-half-off-discounts-a-video-look-back/)
- A Resolume forum thread is titled "You should have a rent license option, like QLab". — [Resolume forum p=42714](https://www.resolume.com/forum/viewtopic.php?p=42714)
- Multi-seat cost (2016-era excerpt): two 2-computer licenses (6 machines incl. backups) cost €2,798, versus €2,699 for a 5-machine license. — [Resolume forum p=66611](https://www.resolume.com/forum/viewtopic.php?p=66611). A user without budget for a second seat asked whether one license could move between laptop and desktop. — [Resolume forum "one License, Many Machines?" p=66571](https://www.resolume.com/forum/viewtopic.php?p=66571)
- Licensing friction offline: users "could not unregister, so they couldn't acquire an ID code for offline registration". — [Resolume forum p=86374 "Urgent: Online and Offline Registration not working"](https://www.resolume.com/forum/viewtopic.php?p=86374). MadMapper says license generation "can take up to 48h". — [MadMapper MadBundle](https://www.madmapper.com/madbundle)
- Learning curve: TouchDesigner is "one of the hardest pieces of software I've ever learned", and YouTube offered no cohesive learning path (creative technologist, Substack). — [Olivia Ema, Substack](https://oliviaema.substack.com/p/navigating-audio-reactive-visuals). On r/vjing (Jul 2024), newcomers were told to "prepare for a big learning curve" with TouchDesigner (excerpt). — [r/vjing mirror](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing/lfbbbbe/?context=3). A reposted Reddit thread says TouchDesigner and Blender "interfaces are both difficult". — [SaaSHub repost](https://www.saashub.com/alternatives/post-reddit-2022-03-10-can-you-use-your-laptop-as-an-video-mixer-instead-of-buying-expensive-equipment-983240)
- OS lock-in: the Millumin FAQ says on Windows: "No, sorry. For now, we are focused on the Mac version." V5 requires macOS Big Sur 11+. MilluNode, a Windows/macOS player, is in beta. — [millumin.com](https://millumin.com/); [Millumin FAQ](https://help.millumin.com/v4/general/faq/). A user thread is titled "Windows Millumin when?". — [Millumin forum comment 3717](https://forum.millumin.com/discussion/comment/3717/). VDMX6 is Metal-based (macOS only). — [VDMX6 blog](https://vdmx.vidvox.net/blog/vdmx6)
- Linux: a Resolume reply (older thread) said a port is possible but "it's still a lot of work and it will probably not lead to more sales". An r/resolume thread (about May 2025, mirror) asked again, and one commenter said Linux buyers would not offset development cost. Users resort to Wine, which is "always hit and miss". — [Resolume forum p=26245](https://resolume.com/forum/viewtopic.php?p=26245); [p=34077](https://resolume.com/forum/viewtopic.php?p=34077); [r/resolume "Any talk about Linux" mirror](https://redlib.hbubli.cc/r/resolume/comments/1kp59ll/any_talk_about_linux)
- Missing preloading: "other media servers preload the opening second or so of clips" and no Resolume equivalent was found (excerpt). — [Resolume forum p=21325](https://www.resolume.com/forum/viewtopic.php?p=21325)
- Missing cue-all-layers and timecode entry (see section 3c). — [Resolume forum p=79463](https://www.resolume.com/forum/viewtopic.php?p=79463)
- Backup sync is DIY: Millumin's official backup method requires third-party Chataigne/Octopus and syncs only column launches. — [Millumin help](https://help.millumin.com/v4/tutorials/setup-a-backup-machine/)
- Controller setup friction: the APC40 mkII preset is not selected automatically. LEDs stay dark until "Output MIDI" is enabled. — [Resolume forum p=67076](https://resolume.com/forum/viewtopic.php?p=67076); [p=39265](https://resolume.com/forum/viewtopic.php?p=39265)

### Inferences
- Positioning opportunities for a browser tool follow directly from these complaints: zero install, every OS including Linux and ChromeOS, an approachable UI, and flexible licensing (per user, not per machine; rent per day or month). Users already ask for these and vendors have declined Linux for business reasons.
- Feature priorities that address explicit requests are: clip preloading/arming; a cue list with timecode and "cue all layers"; built-in backup sync; and plug-and-play controller templates with LED feedback on by default.

### Gaps
- No systematic, quantified survey of VJ pain points (2024–2026) was found. CDM ran a software-usage survey in 2011, which is outdated. — [CDM 2011 survey](https://cdm.link/2011/06/survey-which-vj-visualist-software-do-you-use-live/)
- MadMapper and HeavyM forum complaints were not retrieved in depth. Facebook VJ groups were not accessible.
- Collaboration (multi-user editing, cloud project sharing) appears only as a disguise roadmap item. No user complaints about lack of collaboration were found.

## 5. MIDI controller hardware & presets

### Takeaway
VJs use generic grid and knob controllers (Akai APC40 mkII / APC mini, Novation Launchpad, DJ TechTools Midi Fighter Twister, Behringer and Faderfox units) rather than VJ-specific hardware. Tools ship few factory presets, setup is fiddly, and the APC40 mkII, long the de facto Resolume controller, is discontinued. Good built-in templates with LED feedback are therefore a meaningful onboarding advantage.

### Cited Findings
- A Resolume staffer said there are "only a few factory midi presets shipping with Resolume" and advised users to build their own. The APC40 MK2 preset comes with the installer and may also work for MK1. Preset files live in the app's Default/presets/shortcuts/midi folder (Arena 6 instructions). — [Resolume forum p=87756](https://resolume.com/forum/viewtopic.php?p=87756); [p=75768 "APC40 MKii shortcut preset missing"](https://www.resolume.com/forum/viewtopic.php?p=75768); [p=71798](https://www.resolume.com/forum/viewtopic.php?p=71798); [p=83759 "Akai APC40 MK1 - Shortcut Template"](https://www.resolume.com/forum/viewtopic.php?p=83759)
- A Resolume team member confirmed the APC40 mkII is discontinued. They suggested the Midi Fighter Twister ("very robust") paired with a Launchpad as a replacement (excerpt). — [Resolume forum "ACP40mk2 shortage?" p=92776](https://www.resolume.com/forum/viewtopic.php?p=92776)
- No official Resolume preset was found for the APC mini or Launchpad. Launchpad Mini MK3 pad colors are set via output velocity per the device manual, and one user built a Bome MIDI Translator preset instead (excerpts). — [Resolume forum p=81728](https://resolume.com/forum/viewtopic.php?p=81728); [p=51848](https://resolume.com/forum/viewtopic.php?p=51848)
- Budget and compact picks from forum users: Behringer BCF2000 (buttons, knobs, faders) and Faderfox LC2 (compact, battery, expandable). — [Resolume forum p=76383](https://resolume.com/forum/viewtopic.php?p=76383)
- CDM (older): VJing needs little velocity sensitivity. Pads or a QWERTY keyboard suit triggering, while knobs and sliders handle per-layer parameters. One commenter found "16 knobs is only just enough" for Resolume. — [CDM: MIDI control for VJs](https://cdm.link/cdmotion-preview-midi-control-for-vjs/)
- A Spanish-language "Top 5 MIDIs for VJs for Resolume Arena" video covers the APC40 MK2, with a mapping preset, and the APC Mini. — [SozAI transcript](https://sozai.app/transcript/top-5-midis-vjs-resolume-arena/)
- VIDVOX's gig checklist explicitly asks whether you can run visuals without your MIDI controller, so a keyboard fallback is expected. — [VIDVOX handout 6.3](https://docs.vidvox.net/vv-edu/handout_module_6_3)

### Inferences
- Ship tested templates (auto-detected, with LED/RGB feedback for clip state) for the APC40 mkII, APC mini mk2, Launchpad (Mini MK3/X/Pro), Midi Fighter Twister and Korg nanoKONTROL2, plus MIDI-learn for everything else and full keyboard parity. This turns a known setup pain into a differentiator.
- Browser constraint (to verify technically): the controller workflow depends on Web MIDI availability per browser. Product requirements should state the supported browser/OS matrix explicitly.

### Gaps
- No usage-share data on which controllers VJs use was found. The ranking is anecdotal.
- No source covering the Korg nanoKONTROL in VJ use specifically was retrieved.
- Web MIDI browser support status in 2026 was not verified in this research.

## 6. Market: size, segments, price points, business models

### Takeaway
No credible analyst sizing exists for "VJ software" specifically. Projection-mapping market reports (hardware-dominated) put 2025 at roughly USD 3.2–7.2 bn with 8–20% CAGRs, but they disagree widely and should be treated as low-reliability directional signals. The software market is best characterized bottom-up through vendor price points. These are perpetual licenses of €299–€799 (Resolume), about €400–520 (Millumin, MadMapper) and $199–349 (VDMX), with 12-month update windows and paid renewals. Rentals run €29/week to €49–69/month, and pro tiers reach $2,200 (TouchDesigner Pro) or £99–189/month (Notch). Watermarked unlimited trials and about 50% education discounts are standard.

### Cited Findings
**Market sizing (projection mapping; reliability is low to moderate, scopes differ)**
- MarketsandMarkets puts the market at about USD 3.2–3.8 bn in 2025 and 11.5–13.8 bn by 2036, an 11.5%–13.2% CAGR. Software is the fastest-growing offering, and hardware (high-lumen projectors) dominates. Events & entertainment is the largest application, followed by advertising. North America is the largest region and APAC the fastest-growing. Key players listed are projector makers (Panasonic, Sony, Epson, Barco, Christie). Caveat: the page gives ranges instead of point estimates, the publication date is inconsistent (Aug vs Nov 2026), and the tables reference 2017–2021 data. — [MarketsandMarkets](https://www.marketsandmarkets.com/market-reports/projection-mapping-market-252209050.html)
- Roots Analysis projects USD 4.78 bn in 2026 and 13.53 bn by 2040 (7.72% CAGR). Its segmentation includes software, projectors, media servers and services. — [Roots Analysis](https://www.rootsanalysis.com/projection-mapping-market)
- SkyQuest (via GII) gives USD 4.57 bn (2024) and 5.46 bn (2025), with a 19.4% CAGR to about 22.55 bn by 2033. — [GII/SkyQuest](https://www.gii.tw/report/sky1904778-projection-mapping-market-size-share-growth.html)
- Verified Market Research (via GII) gives USD 7.20 bn (2025) and 36.98 bn (2034), a 19.94% CAGR. — [GII/VMR](https://www.gii.tw/report/vmr2112794-global-projection-mapping-market-size-share-trends.html)
- Technavio (via GII, 2022–2026 report) projects +$5.27 bn of growth at a 22.53% CAGR. — [GII/Technavio](https://cn.gii.tw/report/infi1080290-global-projection-mapping-market.html)
- Lucintel (May 2026) covers mapping software as an offering, but no figures were visible. — [Lucintel](https://lucintel.com/projection-mapping-market.aspx)
- A search for "VJ software market size" returned only unrelated video-software categories (streaming, VMS, capture). No VJ-specific report was found. — [example unrelated result: ISE Magazine](https://www.isemag.com/industry-trends-and-research/article/14293759/video-streaming-software-market-worth-255-billion-by-2028)

**Price points & models (official vendor pages unless noted)**
- **Resolume:** Avenue €299, Arena €799 and Wire €399 (1 computer). Updates are free for 12 months, and "Your last eligible update will always continue working". Arena renewal is €219 per 12 months, and the Avenue→Arena upgrade is €500. Education gets 50% off. The unlimited trial carries a watermark (and a "robot voice" on audio). — [Resolume shop](https://resolume.com/shop); [Resolume renewals](https://resolume.com/shop/upgrade)
- **MadMapper (MadBundle with MadLaser):** rental "From 49€/month excl tax", or "From 519€ excl tax" perpetual, working "forever for the current 6.xx" version. The demo has a watermark on output and input, DMX blackout every 30 s, and laser blackout every 120 s. Third parties list €44/month and €479. — [MadMapper MadBundle](https://www.madmapper.com/madbundle); [Techjockey](https://www.techjockey.com/us/detail/madmapper)
- **Millumin (macOS):** rental costs 29€ (7 days), 69€ (30 days) or 199€ (1 year) per computer. Lifetime licenses start at 399€ (V1–V5), and upgrades start at 85€. The 30-day trial is unlimited, then watermarked. Education: 199€ lifetime or 15€ per year. — [millumin.com](https://millumin.com/); [Millumin educational](https://millumin.com/educational); [Millumin license help](https://help.millumin.com/v4/general/license/)
- **TouchDesigner:** free non-commercial (resolution-limited). Educational $300, Commercial $600 (Floating Cloud $900), Pro $2,200 (Floating Cloud $3,300). Pro updates cost $400 for 1 year or $680 for 2 years, Commercial→Pro costs $1,600, and a USB dongle costs $180. — [TouchDesigner Pro](https://derivative.ca/product/touchdesigner-pro/36); [Licensing](https://derivative.ca/UserGuide/Licensing); [Commercial](https://derivative.ca/product/touchdesigner-commercial); [Upgrades](https://derivative.ca/UserGuide/Upgrades)
- **VDMX6 (macOS):** $199 and VDMX6 Plus $349 currently. The launch price was $99/$249 in Sep 2024, so the price appears to have risen. Educational and hobbyist discounts are available by email. — [VIDVOX cart](https://cart.vidvox.net); [CDM Sep 2024](https://cdm.link/2024/09/vdmx6/); [VIDVOX forum](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337)
- **HeavyM:** Live, Pro and Pro+ are each sold as a one-time "Buy" (perpetual with 1 year of updates; renewal at a discount) or as a monthly rent-to-own plan that becomes owned after 6 months. Refunds are available within 48 h, and frequent "flash sale" banners advertise about 25% off. Exact prices could not be retrieved (403). — [HeavyM pricing](https://www.heavym.net/pricing); [HeavyM upgrades](https://www.heavym.net/updates_upgrades/)
- **Notch (Builder):** Base £99/month and Pro £189/month, with a 6-month minimum term and an annual option. The 2026.1 manual confirms Pro at £189 + VAT/month and says plan changes are coming. — [Notch forum pricing](https://forum.notch.one/t/pricing/370); [Notch manual 2026.1 subscriptions FAQ](https://manual.notch.one/2026.1/en/docs/reference/faq/subscriptions/)
- **QLab:** perpetual, daily rental, or volume license. A user review says rentals convert to ownership after 110 days (low-reliability source). — [Wikipedia: QLab](https://en.wikipedia.org/wiki/QLab); [Capterra review page](https://www.capterra.co.nz/software/146969/qlab)
- **Synesthesia:** one-off licenses (standard and pro) that "do not expire". The trial watermarks output (undated article). — [Vintage Synth Explorer](https://www.vintagesynth.com/articles/best-music-visualizers-your-synth-tracks)
- **Free and open alternatives:** cables.gl (MIT, browser and offline) and TouchDesigner's free non-commercial tier. Reddit lists of alternatives also mention Tooll3, VVVV, Praxis Live, Isadora, Modul8 and HeavyM. — [CDM cables.gl](https://cdm.link/2024/08/cables-gl-open-offline/); [r/vjing mirror](https://lr.sudovanilla.org/r/vjing/comments/1gkid55/seeking_guidance) (excerpt)
- **Browser-based entrant:** 4mapper has a free tier and a PRO tier with 5 GB of cloud storage, listed at $39 one-time on AlternativeTo. Sources conflict and traction is minimal. — [Product Hunt](https://www.producthunt.com/products/4mapper-web-based-projection-mapping); [AlternativeTo](https://alternativeto.net/software/4mapper/about)

### Inferences
- **Price anchors for positioning:** the market tolerates about €300 (entry pro), about €500–800 (mapping pro) and €29–69 per week or month (rental for gigs and temporary installs). A browser tool could plausibly charge about €8–15/month or about €99–199/year for an individual pro tier, plus a free watermarked tier and day or week passes for events. These numbers are proposals derived from the anchors above, not validated willingness-to-pay data.
- **Model patterns that work in this niche:**
  - perpetual license with a 12-month update window and discounted renewal (Resolume, HeavyM, Millumin), which counters subscription fatigue;
  - rent-to-own (HeavyM after 6 months, QLab after 110 days);
  - short rentals for events and installations (Millumin, MadMapper, QLab);
  - unlimited-time watermarked demo (Resolume, MadMapper, Synesthesia);
  - 50% education discount, or very cheap annual edu (Millumin at 15€).

  A web tool can combine these: free with a watermark, monthly or annual, a day or week "show pass", and a perpetual "offline/installation" license.
- **Market sizing approach:** because analyst numbers are hardware-dominated and inconsistent, the report should present them as context only and size the software opportunity bottom-up (vendor pricing × plausible user counts). User-count data was not found.

### Gaps
- No VJ-software-specific market size, user counts or vendor revenues (Resolume, MadMapper, Millumin are private) were found.
- No data on conversion rates for watermark trials or subscription vs perpetual uptake in this niche was found.
- Current HeavyM prices and the Synesthesia price list could not be retrieved.
- No case studies of creative tools sold via the web with subscription vs one-time outcomes (e.g., Figma-style or Spline) were found for this niche.

## 7. Legal / ops aspects for a production web tool

### Takeaway
Venues often have no reliable internet, so incumbents support offline activation with periodic check-ins (Resolume: every 30 days) or dongles, and practitioners carry phone hotspots. A web tool must be fully offline-capable after setup. Bundled shader content is a real legal risk: Shadertoy code defaults to CC BY-NC-SA 3.0 (non-commercial), which bars use at paid gigs, and ISF shader licensing has seen disputes. Telemetry and crash reporting are needed (incumbents rely on manual log collection), but no practitioner sources on privacy expectations were found.

### Cited Findings
- **Offline licensing:**
  - Resolume supports offline registration via an ID code and key file, plus a dongle for fixed installations: "many people run Resolume in fixed art installations without internet access". Offline machines must "phone home every 30 days". — [Resolume article 28](https://resolume.com/article/28); [Resolume v6 registering](https://resolume.com/support/en/6/registering)
  - Isadora documents activation without an internet connection. — [TroikaTronix support](https://support.troikatronix.com/support/solutions/articles/13000071209-activating-isadora-3-without-an-internet-connection)
  - Failure mode: users unable to unregister offline could not obtain an ID code. — [Resolume forum p=86374](https://www.resolume.com/forum/viewtopic.php?p=86374)
  - Practitioners are advised to register all software before the event and "make sure your phone can act as a hotspot if you don't have internet access". — [VIDVOX handout 6.3](https://docs.vidvox.net/vv-edu/handout_module_6_3)
  - MadMapper license generation can take up to 48 h. — [MadMapper](https://www.madmapper.com/madbundle)
- **Shader content licensing:**
  - The Three.js manual shows Shadertoy's default "New" shader labeled CC BY-NC-SA 3.0 Unported, and multiple ports state that Shadertoy content defaults to that license unless the author says otherwise. Shadertoy's own terms page returned 403 and could not be verified directly. — [Three.js manual: Shadertoy](https://threejs.org/manual/en/shadertoy); [Godot Shaders port example](https://godotshaders.com/shader/creation-by-silexars/)
  - A Magic Music Visuals admin says Shadertoy's default is non-commercial, that most shaders "can't be used in commercial projects unless they are explicitly marked", and that this even rules out VJing at a commercial event. By contrast, GLSL Sandbox defaults to public domain. — [Magic Music Visuals forum p=9445](https://magicmusicvisuals.com/forums/viewtopic.php?p=9445); [p=9451](https://magicmusicvisuals.com/forums/viewtopic.php?p=9451)
  - ISF (Interactive Shader Format) is an "open format" (GLSL plus a JSON header), with the spec on GitHub. ISF shader files are described as free for host apps to include, but no explicit license file was verified. — [VIDVOX open source](https://docs.vidvox.net/opensource/); [ISF_Spec GitHub](https://github.com/mrRay/ISF_Spec); [docs.isf.video](https://docs.isf.video/)
  - Licensing disputes happen: a VIDVOX forum thread accuses a user of "stealing shaders and uploading them online with MIT license". ISF conversions of Shadertoy shaders carry CC BY-NC-SA 4.0, which their author glosses as excluding events over 150 visitors. — [VIDVOX discourse](https://discourse.vidvox.net/t/user-bennoh-is-stealing-shaders-and-uploading-them-online-with-mit-license/2682); [VIDVOX discourse ISF conversions](https://discourse.vidvox.net/t/two-weeks-of-isf-shader-conversion/2649)
- **Crash reporting today:** Resolume support depends on users manually locating and attaching crash logs, which some cannot find (excerpt). — [Resolume forum p=81124](https://www.resolume.com/forum/viewtopic.php?p=81124)
- **Backups and versioning as practice:** use version control (GitHub) for complex projects and cloud backup (Google Drive/Backblaze) for critical content. — [VIDVOX handout 6.3](https://docs.vidvox.net/vv-edu/handout_module_6_3)

### Inferences
- **O1 Offline-first:** the full app (PWA or desktop wrapper) and all project media must be stored locally. License validation tolerates at least 30 days offline with a clear grace UI, and never blocks output mid-show. Activation and deactivation must also work offline, which avoids Resolume's unregister trap.
- **O2 Media privacy by default:** process and store media locally, with cloud sync opt-in. This reduces exposure for client-confidential corporate content (unreleased product launches). It is an inference, as no source on VJ privacy expectations was found.
- **O3 Content licensing hygiene:** bundle only shaders under permissive licenses (MIT, CC0, CC BY) with attribution metadata. Do not bundle default-licensed Shadertoy code. Warn users when they import non-commercial-licensed content.
- **O4 Telemetry:** opt-in crash reporting with a one-click "export diagnostic bundle" for offline venues (queue and upload later). Telemetry must never be on the render path.

### Gaps
- No primary Shadertoy terms text could be fetched (403). The CC BY-NC-SA 3.0 default is consistent across secondary sources but unverified at the source.
- The ISF spec repository's LICENSE file was not verified.
- No sources were found on GDPR or data-privacy expectations of VJ/AV clients regarding uploaded media, or on how incumbents handle telemetry consent.
- Browser-specific operational risks (full-screen API exit on Esc, tab throttling, OS notifications over browser full-screen, Wake Lock, Window Management API for multi-display) were not researched here and need technical validation.
