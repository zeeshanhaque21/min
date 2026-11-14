/*
Wraps APIs that are only available in the main process in IPC messages, so that the BrowserWindow can use them
*/

ipc.handle('startFileDrag', function (e, path) {
  app.getFileIcon(path, {}).then(function (icon) {
    e.sender.startDrag({
      file: path,
      icon: icon
    })
  })
})

function showFocusModeDialog1() {
  dialog.showMessageBox({
    type: 'info',
    buttons: [l('closeDialog')],
    message: l('isFocusMode'),
    detail: l('focusModeExplanation1') + ' ' + l('focusModeExplanation2')
  })
}

function showFocusModeDialog2() {
  dialog.showMessageBox({
    type: 'info',
    buttons: [l('closeDialog')],
    message: l('isFocusMode'),
    detail: l('focusModeExplanation2')
  })
}

ipc.handle('showFocusModeDialog2', showFocusModeDialog2)

ipc.handle('showOpenDialog', async function (e, options) {
  const result = await dialog.showOpenDialog(windows.windowFromContents(e.sender).win, options)
  return result.filePaths
})

ipc.handle('showSaveDialog', async function (e, options) {
  const result = await dialog.showSaveDialog(windows.windowFromContents(e.sender).win, options)
  return result.filePath
})

ipc.handle('addWordToSpellCheckerDictionary', function (e, word) {
  session.fromPartition('persist:webcontent').addWordToSpellCheckerDictionary(word)
})

ipc.handle('clearStorageData', function () {
  return session.fromPartition('persist:webcontent').clearStorageData()
  /* It's important not to delete data from file:// from the default partition, since that would also remove internal browser data (such as bookmarks). However, HTTP data does need to be cleared, as there can be leftover data from loading external resources in the browser UI */
    .then(function () {
      return session.defaultSession.clearStorageData({ origin: 'http://' })
    })
    .then(function () {
      return session.defaultSession.clearStorageData({ origin: 'https://' })
    })
    .then(function () {
      return session.fromPartition('persist:webcontent').clearCache()
    })
    .then(function () {
      return session.fromPartition('persist:webcontent').clearHostResolverCache()
    })
    .then(function () {
      return session.fromPartition('persist:webcontent').clearAuthCache()
    })
    .then(function () {
      return session.defaultSession.clearCache()
    })
    .then(function () {
      return session.defaultSession.clearHostResolverCache()
    })
    .then(function () {
      return session.defaultSession.clearAuthCache()
    })
})

ipc.handle('downloadVideoWithYtdlp', async function (e, pageURL) {
  const owner = windows.windowFromContents(e.sender)?.win
  if (!owner || typeof pageURL !== 'string' || pageURL.length > 8192) return
  try {
    const url = new URL(pageURL)
    if (!['http:', 'https:'].includes(url.protocol)) return
  } catch (err) { return }

  const result = await dialog.showOpenDialog(owner, {
    title: 'Choose a folder for the video',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return

  const binary = process.platform === 'darwin' && fs.existsSync('/opt/homebrew/bin/yt-dlp')
    ? '/opt/homebrew/bin/yt-dlp'
    : 'yt-dlp'
  const child = require('child_process').spawn(binary, [
    '--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-overwrites',
    '--paths', result.filePaths[0], '-o', '%(title).150B [%(id)s].%(ext)s', '--', pageURL
  ], {
    shell: false,
    env: { ...process.env, PATH: `${process.env.PATH || ''}${path.delimiter}/opt/homebrew/bin${path.delimiter}/usr/local/bin` }
  })
  let errorOutput = ''
  child.stderr.on('data', chunk => { errorOutput = (errorOutput + chunk.toString()).slice(-4000) })
  child.stdout.resume()
  let spawnError = null
  child.on('error', err => { spawnError = err })
  child.on('close', code => {
    if (code === 0 && !spawnError) {
      dialog.showMessageBox({ type: 'info', title: 'Video downloaded', message: 'The video was saved to the selected folder.' })
    } else {
      dialog.showMessageBox({
        type: 'error',
        title: 'Video download failed',
        message: spawnError?.code === 'ENOENT' ? 'yt-dlp is not installed or could not be found.' : 'yt-dlp could not download this video.',
        detail: spawnError ? spawnError.message : errorOutput || `yt-dlp exited with code ${code}.`
      })
    }
  })
})

/* window actions */

ipc.handle('minimize', function (e) {
  windows.windowFromContents(e.sender).win.minimize()
  // workaround for https://github.com/minbrowser/min/issues/1662
  e.sender.send('minimize')
})

ipc.handle('maximize', function (e) {
  windows.windowFromContents(e.sender).win.maximize()
  // workaround for https://github.com/minbrowser/min/issues/1662
  e.sender.send('maximize')
})

ipc.handle('unmaximize', function (e) {
  windows.windowFromContents(e.sender).win.unmaximize()
  // workaround for https://github.com/minbrowser/min/issues/1662
  e.sender.send('unmaximize')
})

ipc.handle('close', function (e) {
  windows.windowFromContents(e.sender).win.close()
})

ipc.handle('setFullScreen', function (e, fullScreen) {
  windows.windowFromContents(e.sender).win.setFullScreen(e, fullScreen)
})

//workaround for https://github.com/electron/electron/issues/38540
ipc.handle('showItemInFolder', function (e, path) {
  shell.showItemInFolder(path)
})

ipc.on('newWindow', function (e, customArgs) {
  createWindow(customArgs)
})

ipc.handle('clipboardReadText', function() {
  return clipboard.readText()
})

ipc.on('clipboardWriteItem', function(e, data) {
  clipboard.write([new ClipboardItem(data)])
    .catch(e => console.log(e))
})
