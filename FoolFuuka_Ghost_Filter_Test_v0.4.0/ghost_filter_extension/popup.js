const KEY="ghostFilterHiddenPosts";
const KEYWORDS_KEY="ghostFilterKeywords";
const count=document.getElementById("count");
const status=document.getElementById("status");
const editor=document.getElementById("keywords");
function refresh(){
  chrome.storage.local.get({[KEY]:[],[KEYWORDS_KEY]:[]},d=>{
    count.textContent=(d[KEY]||[]).length;
    editor.value=(d[KEYWORDS_KEY]||[]).join("\n");
  });
}
document.getElementById("save-keywords").addEventListener("click",()=>{
  const words=[...new Set(editor.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean))];
  chrome.storage.local.set({[KEYWORDS_KEY]:words},()=>{
    editor.value=words.join("\n");
    status.textContent=`Saved ${words.length} keyword${words.length===1?"":"s"}. Refresh or revisit the archive to scan existing posts.`;
  });
});
document.getElementById("clear").addEventListener("click",()=>{
  chrome.storage.local.set({[KEY]:[]},()=>{
    status.textContent="Manual hidden-post list cleared. Refresh the archive tab to restore posts.";
    refresh();
  });
});
refresh();
