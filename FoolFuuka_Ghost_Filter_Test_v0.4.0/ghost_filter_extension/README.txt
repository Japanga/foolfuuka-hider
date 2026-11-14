# FoolFuuka Ghost Filter — Test Build 0.4.0

## Fix in this version
The previous build set the HTML `hidden` property, but archive CSS can override its default display behavior. This build also applies `display: none !important` and `visibility: hidden !important` directly to the post element, so the original post should disappear from the visible page. It preserves and restores the post's previous inline display setting when Reveal is clicked.

## Update
1. Extract this ZIP into a new folder.
2. Open chrome://extensions.
3. Remove the previous test version, or update its folder and click Reload.
4. Load unpacked and select the extracted folder.
5. Refresh Desuarchive.

The hidden post is replaced by a compact placeholder with a Reveal button. Individual ghost records remain independently stored.
