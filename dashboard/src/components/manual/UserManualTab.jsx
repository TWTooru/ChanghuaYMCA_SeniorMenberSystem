import {
  Activity,
  BookOpen,
  Calendar,
  CheckCircle2,
  CircleHelp,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'
import './userManual.css'

const SHARED_SECTIONS = [
  { id: 'manual-start', label: '快速開始', icon: Activity },
  { id: 'manual-students', label: '學員資料', icon: Users },
  { id: 'manual-enrollments', label: '選課與收費', icon: Calendar },
  { id: 'manual-excel', label: 'Excel 匯入與匯出', icon: FileSpreadsheet },
  { id: 'manual-security', label: '角色權限與資料安全', icon: ShieldCheck },
]

const ROLE_LABELS = {
  owner: '最高管理員',
  admin: '管理員',
  editor: '編輯者',
}

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <header className="manual-section-heading">
      <span className="manual-section-icon" aria-hidden="true"><Icon size={21} /></span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </header>
  )
}

function StepCard({ number, title, children }) {
  return (
    <li className="manual-step-card">
      <span className="manual-step-number" aria-hidden="true">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  )
}

export default function UserManualTab({ role = 'editor' }) {
  const isAdminLike = role === 'admin' || role === 'owner'
  const roleBadge = ROLE_LABELS[role] ? role : 'editor'
  const sections = isAdminLike
    ? [...SHARED_SECTIONS, { id: 'manual-admin', label: '管理員專屬操作', icon: BookOpen }]
    : SHARED_SECTIONS

  return (
    <section className="manual-page" aria-labelledby="user-manual-heading">
      <header className="manual-hero">
        <div className="manual-hero-copy">
          <div className="manual-kicker"><BookOpen size={16} aria-hidden="true" /> 系統操作指南</div>
          <h1 id="user-manual-heading">使用者手冊</h1>
          <p>從查找會員、建立報名，到整理 Excel 資料，依照實際工作流程快速找到需要的操作方式。</p>
        </div>
        <div className={`manual-role-badge manual-role-badge--${roleBadge}`}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>目前權限</span>
          <strong>{ROLE_LABELS[role] || '編輯者'}</strong>
        </div>
      </header>

      <div className="manual-layout">
        <aside className="manual-sidebar">
          <nav className="manual-nav" aria-label="手冊章節">
            <p className="manual-nav-title">章節目錄</p>
            {sections.map(({ id, label, icon: Icon }) => (
              <a href={`#${id}`} key={id}>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="manual-shortcut-card">
            <span className="manual-shortcut-label">快速搜尋</span>
            <strong><kbd>Ctrl</kbd><span>＋</span><kbd>K</kbd></strong>
            <p>在任何頁面開啟會員快速搜尋；Mac 請使用 Command＋K。</p>
          </div>
        </aside>

        <div className="manual-content">
          <section id="manual-start" className="manual-section manual-section--start">
            <SectionHeading
              icon={Activity}
              title="快速開始"
              description="登入後先確認資料庫狀態，再開始查詢或異動資料。"
            />
            <ol className="manual-step-grid" aria-label="開始使用步驟">
              <StepCard number="1" title="確認連線">
                頁首顯示「Supabase 資料庫已連線」後再操作；若顯示離線，先檢查網路並重新整理頁面。
              </StepCard>
              <StepCard number="2" title="先搜尋會員">
                使用「學員清單與查詢」，或按 Ctrl／Command＋K，以姓名、會員編號或聯絡資料尋找既有會員。
              </StepCard>
              <StepCard number="3" title="完成後核對">
                儲存資料後查看畫面是否更新；需要取得資料庫最新內容時，按頁首的「整理同步」。
              </StepCard>
            </ol>
            <div className="manual-callout manual-callout--info">
              <CheckCircle2 size={19} aria-hidden="true" />
              <p><strong>建議順序：</strong>先搜尋、再新增，避免同一位會員因姓名寫法不同而重複建立。</p>
            </div>
          </section>

          <section id="manual-students" className="manual-section manual-section--students">
            <SectionHeading
              icon={Users}
              title="學員資料"
              description="查詢會員基本資料、歷年修課內容，以及新增或修改會員資料。"
            />
            <div className="manual-card-grid">
              <article className="manual-guide-card">
                <span className="manual-card-icon" aria-hidden="true"><Search size={20} /></span>
                <h3>搜尋與檢視</h3>
                <ol>
                  <li>進入「學員清單與查詢」。</li>
                  <li>可搜尋會員編號、姓名、Email、電話、地址或服務機關。</li>
                  <li>搭配性別、教育程度篩選；點選會員列查看完整資料。</li>
                  <li>會員視窗可切換「基本資料」與「歷年修課」。</li>
                </ol>
              </article>
              <article className="manual-guide-card">
                <span className="manual-card-icon" aria-hidden="true"><Users size={20} /></span>
                <h3>新增與修改</h3>
                <ol>
                  <li>確認查無既有資料後，按「新增會員」。</li>
                  <li>依序填寫會員資料與初次報名資料，必填欄位未完成時無法送出。</li>
                  <li>修改時先開啟會員的「基本資料」，再按「編輯」。</li>
                  <li>修改既有會員資料時，離開未儲存的編輯表單會要求確認，避免誤丟資料。</li>
                </ol>
              </article>
            </div>
            <div className="manual-callout manual-callout--warning">
              <CircleHelp size={19} aria-hidden="true" />
              <p>會員編號是串接基本資料與修課紀錄的重要依據。若發現重複會員，請勿自行把紀錄分散到不同編號。</p>
            </div>
          </section>

          <section id="manual-enrollments" className="manual-section manual-section--enrollments">
            <SectionHeading
              icon={Calendar}
              title="選課與收費"
              description="從會員資料建立報名，並在歷程中確認課程、收據與退費狀態。"
            />
            <div className="manual-workflow">
              <div className="manual-workflow-item">
                <span>01</span>
                <div><h3>開啟會員歷程</h3><p>在會員詳細資料切換至「歷年修課」，按「新增選課紀錄」。</p></div>
              </div>
              <div className="manual-workflow-arrow" aria-hidden="true">→</div>
              <div className="manual-workflow-item">
                <span>02</span>
                <div><h3>填寫報名內容</h3><p>選擇期別、報名類型與課程，依表單填寫收費金額、收據號碼及課程歸屬。</p></div>
              </div>
              <div className="manual-workflow-arrow" aria-hidden="true">→</div>
              <div className="manual-workflow-item">
                <span>03</span>
                <div><h3>儲存並核對</h3><p>儲存後回到歷程，確認期別、課程標籤、金額與收據資料皆正確。</p></div>
              </div>
            </div>
            <article className="manual-detail-panel">
              <div>
                <h3>如何查收費紀錄</h3>
                <p>進入「歷年選課歷程」，可用姓名、課程名稱或收據 No. 搜尋，並依期別與收費狀況篩選。</p>
              </div>
              <ul>
                <li>點選紀錄列可查看該筆報名的收費明細。</li>
                <li>若同一期有多張報名表或收據，請逐筆核對課程歸屬。</li>
                <li>退費時應同步確認退費狀態與金額，避免統計結果不一致。</li>
              </ul>
            </article>
          </section>

          <section id="manual-excel" className="manual-section manual-section--excel">
            <SectionHeading
              icon={FileSpreadsheet}
              title="Excel 匯入與匯出"
              description="批次處理資料前先預覽，完成後保留系統回傳的結果。"
            />
            <div className="manual-card-grid">
              <article className="manual-guide-card manual-guide-card--accent">
                <span className="manual-card-icon" aria-hidden="true"><Upload size={20} /></span>
                <h3>匯入會員 Excel／CSV</h3>
                <ol>
                  <li>按頁首的「匯入會員 Excel／CSV」，選擇 .xlsx、.xls 或 .csv 檔。</li>
                  <li>先檢查匯入預覽中的新增、更新、提醒及錯誤資料。</li>
                  <li>內容正確後才按確認匯入；關閉預覽不會寫入資料庫。</li>
                  <li>新會員若由系統指派編號，請複製並保存畫面上的編號對照。</li>
                </ol>
              </article>
              <article className="manual-guide-card manual-guide-card--accent">
                <span className="manual-card-icon" aria-hidden="true"><Download size={20} /></span>
                <h3>下載整理版 Excel</h3>
                <ol>
                  <li>按頁首的「下載整理版 Excel」。</li>
                  <li>選擇全部歷史資料或指定單一期別。</li>
                  <li>勾選需要的工作表：統計摘要、會員資料、報名明細及課程統計。</li>
                  <li>至少保留一個工作表，再按「確認下載」。</li>
                </ol>
              </article>
            </div>
            <div className="manual-callout manual-callout--success">
              <RefreshCw size={19} aria-hidden="true" />
              <p>大量匯入後，請抽查數筆會員與報名紀錄；若畫面仍是舊資料，可按「整理同步」重新讀取。</p>
            </div>
          </section>

          <section id="manual-security" className="manual-section manual-section--security">
            <SectionHeading
              icon={ShieldCheck}
              title="角色權限與資料安全"
              description="畫面只會顯示目前角色可使用的操作；後端仍會再次檢查權限。"
            />
            <div className="manual-table-wrap">
              <table className="manual-permission-table" aria-label="角色權限一覽">
                <thead>
                  <tr><th scope="col">功能</th><th scope="col">檢視者</th><th scope="col">編輯者</th><th scope="col">管理員</th><th scope="col">最高管理員</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">查詢與匯出</th><td>可使用</td><td>可使用</td><td>可使用</td><td>可使用</td></tr>
                  <tr><th scope="row">新增／修改會員與報名</th><td>—</td><td>可使用</td><td>可使用</td><td>可使用</td></tr>
                  <tr><th scope="row">Excel／CSV 匯入與整理同步</th><td>—</td><td>可使用</td><td>可使用</td><td>可使用</td></tr>
                  <tr><th scope="row">刪除資料與課程管理</th><td>—</td><td>—</td><td>可使用</td><td>可使用</td></tr>
                  <tr><th scope="row">帳號管理</th><td>—</td><td>—</td><td>限檢視者／編輯者</td><td>可管理一般管理員</td></tr>
                  <tr><th scope="row">查看本使用者手冊</th><td>—</td><td>可使用</td><td>可使用</td><td>可使用</td></tr>
                </tbody>
              </table>
            </div>
            {!isAdminLike && (
              <div className="manual-access-note">
                <ShieldCheck size={19} aria-hidden="true" />
                <p><strong>你的角色是編輯者：</strong>編輯者無法使用帳號管理、課程管理及刪除功能。如需執行這些操作，請聯繫管理員。</p>
              </div>
            )}
            <ul className="manual-safety-list">
              <li>不要共用帳號；完成操作後請登出，尤其是在公用電腦上。</li>
              <li>匯出檔案含會員個人資料，只能存放於核准位置，不應透過私人通訊軟體轉傳。</li>
              <li>修改大量資料前先確認期別與會員編號，完成後再抽查結果。</li>
            </ul>
          </section>

          {isAdminLike && (
            <section id="manual-admin" className="manual-section manual-section--admin">
              <SectionHeading
                icon={BookOpen}
                title="管理員專屬操作"
                description="以下功能具有較高影響範圍，執行前請再次確認目標資料。"
              />
              <div className="manual-card-grid">
                <article className="manual-guide-card">
                  <h3>課程管理</h3>
                  <p>在「課程管理」新增、停用或重新啟用課程。停用課程不會刪除既有歷史資料，但不再提供新報名選用。</p>
                </article>
                <article className="manual-guide-card">
                  <h3>帳號管理</h3>
                  <p>在「帳號管理」邀請使用者、調整角色、重寄邀請或寄送密碼重設。變更角色前先確認對方的工作需求。</p>
                </article>
              </div>
              <div className="manual-access-note manual-access-note--governance">
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <p>只有最高管理員可以管理一般管理員。</p>
                  <p>一般管理員只能管理檢視者與編輯者，不能管理其他管理員或最高管理員。</p>
                  <p>最高管理員帳號固定，無法透過 UI 或 API 指派、變更或刪除。</p>
                </div>
              </div>
              <div className="manual-callout manual-callout--danger">
                <ShieldCheck size={19} aria-hidden="true" />
                <p><strong>刪除無法復原：</strong>刪除會員會一併移除其選課紀錄。若只是資料關聯錯誤，請先到「疑難雜症」查看處理方式。</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
