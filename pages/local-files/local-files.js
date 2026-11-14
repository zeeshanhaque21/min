/* Files remain in the browser's file picker sandbox and are never uploaded. */
const picker = document.getElementById('folder')
const items = document.getElementById('items')
const status = document.getElementById('status')
const pathLabel = document.getElementById('path')
const up = document.getElementById('up')
const list = document.getElementById('list')
const gallery = document.getElementById('gallery')
const preview = document.getElementById('preview')
const media = document.getElementById('media')
let files = []
let folder = ''
let galleryMode = false
let urls = []
let previewURL = null

function releaseItems () {
  urls.forEach(url => URL.revokeObjectURL(url))
  urls = []
}

function mediaType (file) {
  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)) return 'image'
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)) return 'video'
  return ''
}

function showFile (file) {
  const type = mediaType(file)
  let element
  if (type) {
    previewURL = URL.createObjectURL(file)
    element = document.createElement(type === 'video' ? 'video' : 'img')
    if (type === 'video') element.controls = true
    else element.alt = file.name
    element.src = previewURL
  } else {
    element = document.createElement('p')
    element.textContent = `${file.type || 'File'} · ${file.size.toLocaleString()} bytes. Preview is available for images and videos.`
  }
  media.replaceChildren(element)
  document.getElementById('preview-title').textContent = file.name
  preview.showModal()
}

preview.addEventListener('close', () => {
  media.replaceChildren()
  if (previewURL) URL.revokeObjectURL(previewURL)
  previewURL = null
})
document.getElementById('close').addEventListener('click', () => preview.close())

function render () {
  releaseItems()
  items.replaceChildren()
  items.classList.toggle('gallery', galleryMode)
  list.setAttribute('aria-pressed', String(!galleryMode))
  gallery.setAttribute('aria-pressed', String(galleryMode))
  pathLabel.textContent = folder || 'No folder selected'
  up.disabled = !folder.includes('/')
  if (!folder) return

  const dirs = new Set()
  const currentFiles = []
  for (const file of files) {
    if (!file.webkitRelativePath.startsWith(folder + '/')) continue
    const relative = file.webkitRelativePath.slice(folder.length + 1)
    if (relative.includes('/')) dirs.add(relative.split('/')[0])
    else currentFiles.push(file)
  }
  const entries = [...Array.from(dirs).sort((a, b) => a.localeCompare(b)).map(name => ({ name, directory: true })),
    ...currentFiles.sort((a, b) => a.name.localeCompare(b.name)).filter(file => !galleryMode || mediaType(file)).map(file => ({ name: file.name, file }))]
  status.textContent = entries.length ? `${entries.length} item${entries.length === 1 ? '' : 's'}` : 'No files in this view.'
  for (const entry of entries) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'item'
    const type = entry.file && mediaType(entry.file)
    if (galleryMode && type === 'image') {
      const image = document.createElement('img')
      const url = URL.createObjectURL(entry.file)
      urls.push(url)
      image.src = url
      image.alt = ''
      image.loading = 'lazy'
      button.appendChild(image)
    } else {
      const icon = document.createElement('span')
      icon.className = 'placeholder'
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = entry.directory ? '📁' : type === 'video' ? '▶' : '📄'
      button.appendChild(icon)
    }
    const name = document.createElement('span')
    name.textContent = entry.name
    button.appendChild(name)
    button.addEventListener('click', () => {
      if (entry.directory) { folder += '/' + entry.name; render() } else showFile(entry.file)
    })
    items.appendChild(button)
  }
}

picker.addEventListener('change', () => {
  files = Array.from(picker.files)
  folder = files[0]?.webkitRelativePath.split('/')[0] || ''
  status.textContent = folder ? '' : 'No files found. Choose a folder containing files.'
  render()
})
up.addEventListener('click', () => { folder = folder.slice(0, folder.lastIndexOf('/')); render() })
list.addEventListener('click', () => { galleryMode = false; render() })
gallery.addEventListener('click', () => { galleryMode = true; render() })
window.addEventListener('unload', releaseItems)
