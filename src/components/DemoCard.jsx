/**
 * Demo playlist card - appears in the recent playlists area for new users
 * @param {object} props
 * @param {() => void} props.onLoadDemo - Handler when user clicks the demo card
 * @param {boolean} [props.disabled] - Whether the card is disabled
 */
export default function DemoCard({ onLoadDemo, disabled = false }) {
  return (
    <section aria-labelledby="demo-heading" className="recent-section">
      <div className="recent-header">
        <h2 id="demo-heading">No playlist link? Try our demo</h2>
      </div>
      <ul className="recent-grid" role="list">
        <li className="recent-card">
          <button
            type="button"
            onClick={onLoadDemo}
            className="recent-card__button"
            disabled={disabled}
            aria-label="Load demo playlist with timestamped notes"
          >
            <div className="recent-card__media" aria-hidden="true">
              <div className="recent-card__fallback" style={{ background: 'var(--accent, #4caf50)' }}>
                <span aria-hidden="true">♪</span>
              </div>
            </div>
            <div className="recent-card__body">
              <p className="recent-card__title">Notable Samples</p>
              <p className="recent-card__meta">
                <span className="recent-card__provider">Demo</span>
                <span> - Classic tracks with notes</span>
              </p>
              <p className="recent-card__recency">
                Try adding your own notes and tags
              </p>
            </div>
          </button>
        </li>
      </ul>
    </section>
  )
}
