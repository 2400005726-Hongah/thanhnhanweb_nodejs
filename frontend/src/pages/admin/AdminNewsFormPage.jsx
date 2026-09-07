import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { createNews, getNewsDetail, updateNews } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import {
  deleteNewsEditorImage,
  uploadNewsEditorImage,
} from '../../services/newsImage.service.js'
import './AdminNewsEditor.css'

const EMPTY = {
  title: '',
  summary: '',
  thumbnailUrl: '',
  status: 'DRAFT',
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_INLINE_IMAGES = 20

const makeId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

const makeTextBlock = (value = '') => ({
  id: makeId(),
  type: 'text',
  value,
})

const makeImageBlock = ({
  url = '',
  file = null,
  preview = '',
  caption = '',
  alt = '',
} = {}) => ({
  id: makeId(),
  type: 'image',
  url,
  file,
  preview,
  caption,
  alt,
})

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const textToHtml = (value = '') => {
  const normalized = String(value).replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const serializeBlocks = (blocks) =>
  blocks
    .map((block) => {
      if (block.type === 'text') return textToHtml(block.value)
      if (!block.url) return ''

      const caption = String(block.caption || '').trim()
      const alt = String(block.alt || caption || 'Ảnh nội dung tin tức').trim()

      return [
        '<figure>',
        `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(alt)}" loading="lazy">`,
        caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '',
        '</figure>',
      ].join('')
    })
    .join('')

const parseContentBlocks = (content = '') => {
  const raw = String(content || '').trim()
  if (!raw) return [makeTextBlock()]

  const document = new DOMParser().parseFromString(raw, 'text/html')
  const blocks = []

  const pushText = (value) => {
    const text = String(value || '').trim()
    if (!text) return

    const previous = blocks.at(-1)
    if (previous?.type === 'text') {
      previous.value = `${previous.value}\n\n${text}`
    } else {
      blocks.push(makeTextBlock(text))
    }
  }

  for (const node of document.body.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent)
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const tag = node.tagName.toLowerCase()

    if (tag === 'img') {
      blocks.push(makeImageBlock({
        url: node.getAttribute('src') || '',
        alt: node.getAttribute('alt') || '',
      }))
      continue
    }

    if (tag === 'figure') {
      const image = node.querySelector('img')
      if (image) {
        blocks.push(makeImageBlock({
          url: image.getAttribute('src') || '',
          alt: image.getAttribute('alt') || '',
          caption: node.querySelector('figcaption')?.textContent || '',
        }))
        continue
      }
    }

    if (['p', 'h2', 'h3', 'blockquote', 'li'].includes(tag)) {
      pushText(node.innerText || node.textContent)
      continue
    }

    if (['ul', 'ol'].includes(tag)) {
      const lines = [...node.querySelectorAll('li')]
        .map((item) => `• ${item.textContent?.trim() || ''}`)
        .filter((item) => item !== '• ')
      pushText(lines.join('\n'))
      continue
    }

    pushText(node.innerText || node.textContent)
  }

  if (!blocks.length) blocks.push(makeTextBlock(raw))
  if (blocks[0]?.type === 'image') blocks.unshift(makeTextBlock())
  if (blocks.at(-1)?.type === 'image') blocks.push(makeTextBlock())

  return blocks
}

const validateImageFile = (file) => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WEBP.'
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Mỗi ảnh không được vượt quá 5 MB.'
  }
  return ''
}

function AdminNewsFormPage({ mode = 'create' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = mode === 'edit'
  const previewUrls = useRef(new Set())

  const [form, setForm] = useState({ ...EMPTY })
  const [contentBlocks, setContentBlocks] = useState([makeTextBlock()])
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [savingLabel, setSavingLabel] = useState('')
  const [error, setError] = useState('')
  const [found, setFound] = useState(!editing)

  const createPreview = (file) => {
    const url = URL.createObjectURL(file)
    previewUrls.current.add(url)
    return url
  }

  const revokePreview = (url) => {
    if (!url || !previewUrls.current.has(url)) return
    URL.revokeObjectURL(url)
    previewUrls.current.delete(url)
  }

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }, [])

  const load = useCallback(async () => {
    if (!editing) return

    setLoading(true)
    setError('')

    try {
      const data = await getNewsDetail(id)
      const news = data.news
      if (!news) throw new Error('Không tìm thấy tin tức.')

      setFound(true)
      setForm({
        title: news.title || '',
        summary: news.summary || '',
        thumbnailUrl: news.thumbnailUrl || '',
        status: news.status || 'DRAFT',
      })
      setContentBlocks(parseContentBlocks(news.content))
    } catch (requestError) {
      setFound(false)
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [editing, id])

  useEffect(() => {
    load()
  }, [load])

  const updateField = (event) => {
    const { name, value } = event.target

    if (name === 'thumbnailUrl') {
      setThumbnailFile(null)
      revokePreview(thumbnailPreview)
      setThumbnailPreview('')
    }

    setForm((current) => ({ ...current, [name]: value }))
  }

  const chooseThumbnail = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = validateImageFile(file)
    if (validationError) return setError(validationError)

    revokePreview(thumbnailPreview)
    setThumbnailFile(file)
    setThumbnailPreview(createPreview(file))
    setError('')
  }

  const removeThumbnail = () => {
    revokePreview(thumbnailPreview)
    setThumbnailFile(null)
    setThumbnailPreview('')
    setForm((current) => ({ ...current, thumbnailUrl: '' }))
  }

  const updateTextBlock = (blockId, value) => {
    setContentBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, value } : block,
      ),
    )
  }

  const updateImageBlock = (blockId, field, value) => {
    setContentBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, [field]: value } : block,
      ),
    )
  }

  const insertImageAfter = (blockId, file) => {
    const validationError = validateImageFile(file)
    if (validationError) return setError(validationError)

    const imageCount = contentBlocks.filter((block) => block.type === 'image').length
    if (imageCount >= MAX_INLINE_IMAGES) {
      return setError(`Mỗi bài viết tối đa ${MAX_INLINE_IMAGES} ảnh nội dung.`)
    }

    const imageBlock = makeImageBlock({
      file,
      preview: createPreview(file),
      alt: file.name.replace(/\.[^.]+$/, ''),
    })
    const textBlock = makeTextBlock()

    setContentBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId)
      if (index < 0) return [...current, imageBlock, textBlock]

      const next = [...current]
      next.splice(index + 1, 0, imageBlock, textBlock)
      return next
    })
    setError('')
  }

  const chooseInlineImage = (event, afterBlockId) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) insertImageAfter(afterBlockId, file)
  }

  const replaceInlineImage = (event, blockId) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = validateImageFile(file)
    if (validationError) return setError(validationError)

    setContentBlocks((current) =>
      current.map((block) => {
        if (block.id !== blockId || block.type !== 'image') return block
        revokePreview(block.preview)
        return {
          ...block,
          file,
          preview: createPreview(file),
          url: '',
          alt: file.name.replace(/\.[^.]+$/, ''),
        }
      }),
    )
    setError('')
  }

  const removeBlock = (blockId) => {
    setContentBlocks((current) => {
      const target = current.find((block) => block.id === blockId)
      if (target?.type === 'image') revokePreview(target.preview)

      const next = current.filter((block) => block.id !== blockId)
      if (!next.length) return [makeTextBlock()]
      return next
    })
  }

  const moveBlock = (blockId, direction) => {
    setContentBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current

      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addTextAtEnd = () => {
    setContentBlocks((current) => [...current, makeTextBlock()])
  }

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return

    const hasText = contentBlocks.some(
      (block) => block.type === 'text' && block.value.trim(),
    )
    if (!hasText) {
      setError('Nội dung bài viết phải có ít nhất một đoạn chữ.')
      return
    }

    setSaving(true)
    setError('')
    const uploadedImages = []

    try {
      let thumbnailUrl = form.thumbnailUrl || null

      if (thumbnailFile) {
        setSavingLabel('Đang tải ảnh đại diện...')
        const result = await uploadNewsEditorImage(thumbnailFile)
        uploadedImages.push(result.image)
        thumbnailUrl = result.image.url
      }

      const blocks = contentBlocks.map((block) => ({ ...block }))
      const localImages = blocks.filter(
        (block) => block.type === 'image' && block.file,
      )

      for (let index = 0; index < localImages.length; index += 1) {
        const block = localImages[index]
        setSavingLabel(`Đang tải ảnh nội dung ${index + 1}/${localImages.length}...`)
        const result = await uploadNewsEditorImage(block.file)
        uploadedImages.push(result.image)
        block.url = result.image.url
        block.file = null
        block.preview = ''
      }

      const content = serializeBlocks(blocks)
      setSavingLabel('Đang lưu bài viết...')

      const payload = {
        ...form,
        thumbnailUrl,
        content,
      }

      if (editing) await updateNews(id, payload)
      else await createNews(payload)

      navigate('/admin/tin-tuc', { replace: true })
    } catch (requestError) {
      for (const image of uploadedImages.reverse()) {
        if (!image?.path) continue
        try {
          await deleteNewsEditorImage(image.path)
        } catch {
          // Không che lỗi lưu bài chính nếu bước dọn ảnh tạm thất bại.
        }
      }
      setError(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
      setSavingLabel('')
    }
  }

  if (loading) return <LoadingState />

  if (editing && !found) {
    return (
      <ErrorState
        message={error || 'Không tìm thấy tin tức.'}
        onRetry={load}
      />
    )
  }

  const thumbnailSrc = thumbnailPreview || form.thumbnailUrl

  return (
    <div className="admin-crud-page">
      <AdminPageHeader
        title={editing ? 'Sửa tin tức' : 'Thêm tin tức'}
        description="Soạn bài theo từng đoạn và có thể chèn nhiều ảnh vào đúng vị trí trong nội dung."
      />

      <section className="admin-panel admin-news-editor">
        {error && <div className="alert alert-danger">{error}</div>}

        <form className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field admin-field--wide">
            <span>Tiêu đề</span>
            <input
              className="form-control"
              name="title"
              onChange={updateField}
              required
              value={form.title}
            />
          </label>

          <label className="admin-field admin-field--wide">
            <span>Tóm tắt</span>
            <textarea
              className="form-control"
              name="summary"
              onChange={updateField}
              rows="2"
              value={form.summary}
            />
          </label>

          <div className="admin-field admin-field--wide">
            <div className="news-editor-heading">
              <span>Nội dung bài viết</span>
              <small>Viết đoạn → chèn ảnh → viết tiếp. Có thể dùng nhiều ảnh.</small>
            </div>

            <div className="news-block-editor">
              {contentBlocks.map((block, index) => (
                <div
                  className={`news-editor-block news-editor-block--${block.type}`}
                  key={block.id}
                >
                  <div className="news-editor-block__top">
                    <span>{block.type === 'text' ? `Đoạn ${index + 1}` : 'Ảnh nội dung'}</span>
                    <div className="news-editor-block__actions">
                      <button
                        disabled={index === 0}
                        onClick={() => moveBlock(block.id, -1)}
                        type="button"
                      >↑</button>
                      <button
                        disabled={index === contentBlocks.length - 1}
                        onClick={() => moveBlock(block.id, 1)}
                        type="button"
                      >↓</button>
                      {contentBlocks.length > 1 && (
                        <button
                          className="is-danger"
                          onClick={() => removeBlock(block.id)}
                          type="button"
                        >Xóa</button>
                      )}
                    </div>
                  </div>

                  {block.type === 'text' ? (
                    <>
                      <textarea
                        className="form-control news-editor-textarea"
                        onChange={(event) => updateTextBlock(block.id, event.target.value)}
                        placeholder="Nhập nội dung đoạn này..."
                        rows="5"
                        value={block.value}
                      />
                      <label className="news-insert-image-btn">
                        + Chèn ảnh sau đoạn này
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          className="visually-hidden"
                          onChange={(event) => chooseInlineImage(event, block.id)}
                          type="file"
                        />
                      </label>
                    </>
                  ) : (
                    <div className="news-inline-image-editor">
                      <img
                        alt={block.alt || 'Ảnh nội dung'}
                        src={block.preview || block.url}
                      />
                      <div className="news-inline-image-editor__fields">
                        <label>
                          <span>Chú thích ảnh (không bắt buộc)</span>
                          <input
                            className="form-control"
                            onChange={(event) => updateImageBlock(block.id, 'caption', event.target.value)}
                            placeholder="Ví dụ: Xe Thành Nhân tại bến..."
                            value={block.caption}
                          />
                        </label>
                        <label className="btn btn-outline-secondary btn-sm">
                          Thay ảnh
                          <input
                            accept="image/jpeg,image/png,image/webp"
                            className="visually-hidden"
                            onChange={(event) => replaceInlineImage(event, block.id)}
                            type="file"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                className="news-add-text-btn"
                onClick={addTextAtEnd}
                type="button"
              >+ Thêm đoạn văn cuối bài</button>
            </div>
          </div>

          <div className="admin-field admin-field--wide">
            <span>Ảnh đại diện</span>
            <div className="admin-news-image-picker">
              <label className="btn btn-outline-secondary btn-sm mb-0">
                Chọn ảnh từ máy
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="visually-hidden"
                  onChange={chooseThumbnail}
                  type="file"
                />
              </label>
              <span className="text-muted small">JPG, PNG, WEBP; tối đa 5 MB.</span>
              {thumbnailSrc && (
                <button
                  className="btn btn-link btn-sm text-danger"
                  onClick={removeThumbnail}
                  type="button"
                >Bỏ ảnh</button>
              )}
            </div>

            <input
              className="form-control mt-2"
              name="thumbnailUrl"
              onChange={updateField}
              placeholder="Hoặc dán URL ảnh https://..."
              value={thumbnailFile ? '' : form.thumbnailUrl}
            />

            {thumbnailFile && (
              <div className="small text-success mt-2">Đã chọn: {thumbnailFile.name}</div>
            )}

            {thumbnailSrc && (
              <img
                alt="Xem trước ảnh đại diện"
                className="admin-news-image-preview mt-2"
                src={thumbnailSrc}
              />
            )}
          </div>

          <label className="admin-field">
            <span>Trạng thái</span>
            <select
              className="form-select"
              name="status"
              onChange={updateField}
              value={form.status}
            >
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đã đăng</option>
              <option value="INACTIVE">Ẩn</option>
            </select>
          </label>

          <div className="admin-field admin-field--wide admin-crud-actions">
            <Link className="btn btn-outline-secondary" to="/admin/tin-tuc">Hủy</Link>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? savingLabel || 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm tin tức'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default AdminNewsFormPage
