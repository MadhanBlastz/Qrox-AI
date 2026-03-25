//  BOOT
// ════════════════════════════════════════════
init();
// Check for shared chat URL on load
sharedInit();
// Check for collab URL on load
collabInitFromURL();
// Update share button visibility after init
setTimeout(_shareUpdateBtn, 200);
// Render provider status on welcome screen
setTimeout(wsRenderProviders, 100);
// Render health tooltip on model pill
setTimeout(renderHealthTooltip, 500);
// Init voice system
voiceInit();
// Load templates
// Load personas
personaLoad();
// Load custom pipelines into registry
apeLoadAllSaved();
// Initial context meter update
setTimeout(ctxUpdate, 300);
// Retroactively title existing sessions
setTimeout(smartTitleRetroactive, 3000);
// Init ambient audio
audioInit();
// Init ghost mode
ghostInit();
