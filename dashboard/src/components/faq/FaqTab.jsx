import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import './faq.css'

function resolveSrc(url) {
  if (!url) return url
  // 如果是絕對路徑開頭 (如 /faq/q1/1.jpg)，搭配 Vite 的 BASE_URL (如 ./) 轉為正確相對路徑
  if (url.startsWith('/') && !url.startsWith('//')) {
    const baseUrl = import.meta.env.BASE_URL || './'
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    return `${cleanBase}${url.slice(1)}`
  }
  return url
}

function FaqImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef(null)

  const finalSrc = resolveSrc(src)

  useEffect(() => {
    // 處理瀏覽器快取圖片：若圖片已加載完成，直接標記為 loaded
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true)
      }
    }
  }, [finalSrc])

  if (error) {
    return (
      <div className="faq-img-error">
        ⚠️ 圖片載入失敗，請確認網址是否正確（{src}）
      </div>
    )
  }

  return (
    <div className="faq-img-wrap">
      {!loaded && <div className="faq-img-skeleton" aria-hidden="true" />}
      <img
        ref={imgRef}
        src={finalSrc}
        alt={alt ?? ''}
        className={`faq-md-img${loaded ? '' : ' faq-md-img--hidden'}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}

function cleanIndent(text) {
  if (!text) return ''
  const unescaped = text.replace(/\\n/g, '\n')
  return unescaped
    .split('\n')
    .map(line => line.replace(/^\s{1,4}/, ''))
    .join('\n')
    .trim()
}

const INITIAL_NOTES = [
  {
    id: 1,
    title: 'Q1：如何同步相同學員的修課紀錄？',
    content: `

**Step 1. 進入 Supabase Dashboard**
* 點擊右上角「Dashboard」，理論上會看到 Organizations。
* [點此前往本專案 Supabase 捷徑](https://supabase.com/dashboard/project/hkmbzvyxynpqsxfsinht)

![1](/faq/q1/1.jpg)

---

**Step 2. 進入 Table Editor**
* 點擊選單的 **「Table Editor」**。

![2](/faq/q1/2.jpg)

---

**Step 3. 選擇 enrollments 資料表**
* 選擇 **「enrollments」** 資料表。

![3](/faq/q1/3.jpg)

---

**Step 4. 搜尋學員 ID 與確認資料**
* 在這裡搜尋學員 ID（例如 ID 39 的美玉姊），注意到 \`student_id\`。

![4](/faq/q1/4.jpg)

---

**Step 5. 編輯與同步修課紀錄**
* 右鍵點擊目標資料列，選擇 **「Edit row」** 會跳出編輯視窗。
* 找到 \`student_id\` 欄位，將其改為要同步的學員 ID，然後按下 **「Save」**。
* ![5](/faq/q1/5.jpg)
* ![6](/faq/q1/6.jpg)
---

**Step 6. 完成確認**
* 這樣就完成了，等轉移完修課紀錄後再將重複的學員資料刪除即可。


`,
    color: 'yellow',
  },


  {
    id: 2,
    title: 'Q2：系統維護與問題回報說明',
    content: `### 💡 系統維護提示
若有遇到其他無法自行解決的問題，歡迎直接 Mail 聯繫管理員，謝謝！`,
    color: 'blue',
  },
]

export default function FaqTab() {
  const [openIds, setOpenIds] = useState(new Set())

  const toggle = id => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="faq-tab" aria-label="疑難雜症">
      <h1 className="faq-heading">疑難雜症 / 常見問題</h1>
      <p className="faq-subtitle">目前想到的問題解決辦法，有遇到別的再Mail我</p>

      <div className="faq-grid">
        {INITIAL_NOTES.map(note => {
          const open = openIds.has(note.id)
          return (
            <div
              key={note.id}
              className={`faq-note faq-note--${note.color} ${open ? 'faq-note--open' : ''}`}
            >
              <button
                type="button"
                className="faq-note-header"
                aria-expanded={open}
                onClick={() => toggle(note.id)}
              >
                <span className="faq-note-title">{note.title}</span>
                <span className="faq-note-chevron" aria-hidden="true">
                  {open ? '▲' : '▼'}
                </span>
              </button>

              {open && (
                <div className="faq-note-body">
                  <Markdown
                    components={{
                      img: ({ src, alt }) => <FaqImage src={src} alt={alt} />,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {cleanIndent(note.content)}
                  </Markdown>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
