import React from 'react';

/**
 * Monthly Sales Revenue SVG Bar Chart
 */
export function MonthlySalesBarChart({ data = [], isKn = false }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--secondary-text)', fontSize: '0.85rem' }}>
        {isKn ? 'ಮಾಸಿಕ ಮಾರಾಟದ ಯಾವುದೇ ದಾಖಲೆಗಳಿಲ್ಲ' : 'No monthly sales records available'}
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.amount), 1000);
  const chartHeight = 160;
  const chartWidth = 320;
  const barWidth = Math.max(16, Math.floor((chartWidth - (data.length * 10)) / data.length));

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${chartWidth + 40} ${chartHeight + 40}`}
        style={{ width: '100%', maxHeight: '220px', display: 'block' }}
        role="img"
        aria-label="Monthly Sales Revenue Bar Chart"
      >
        {/* Y Axis line */}
        <line x1="40" y1="10" x2="40" y2={chartHeight + 10} stroke="var(--border, #cbd5e1)" strokeWidth="1" />
        {/* X Axis line */}
        <line x1="40" y1={chartHeight + 10} x2={chartWidth + 30} y2={chartHeight + 10} stroke="var(--border, #cbd5e1)" strokeWidth="1" />

        {/* Y Axis Grid & Labels */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = chartHeight + 10 - (pct * chartHeight);
          const val = Math.round(maxVal * pct);
          return (
            <g key={i}>
              <line x1="36" y1={y} x2={chartWidth + 30} y2={y} stroke="var(--border, #e2e8f0)" strokeDasharray="3 3" strokeWidth="0.8" />
              <text x="32" y={y + 3} textAnchor="end" fontSize="9" fill="var(--secondary-text, #64748b)">
                ₹{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, idx) => {
          const h = (d.amount / maxVal) * chartHeight;
          const x = 50 + idx * (barWidth + 12);
          const y = chartHeight + 10 - h;
          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(h, 2)}
                fill="#059669"
                rx="3"
                style={{ transition: 'height 0.3s ease' }}
              >
                <title>{`${d.month}: ₹${d.amount.toLocaleString('en-IN')}`}</title>
              </rect>
              {/* Value label on top of bar */}
              {h > 20 && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--text, #1e293b)">
                  ₹{d.amount >= 1000 ? `${(d.amount / 1000).toFixed(1)}k` : d.amount}
                </text>
              )}
              {/* X Axis Label */}
              <text x={x + barWidth / 2} y={chartHeight + 25} textAnchor="middle" fontSize="9" fill="var(--secondary-text, #64748b)">
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Orders by Lifecycle Stage Horizontal Bar Chart
 */
export function OrdersByStageBarChart({ stageCounts = {}, isKn = false }) {
  const stages = [
    { key: 'placed', labelKn: 'ಸ್ವೀಕರಿಸಲಾಗಿದೆ', labelEn: 'Placed', color: '#3B82F6' },
    { key: 'confirmed', labelKn: 'ದೃಢೀಕರಿಸಲಾಗಿದೆ', labelEn: 'Confirmed', color: '#D97706' },
    { key: 'preparing', labelKn: 'ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ', labelEn: 'Preparing', color: '#EA580C' },
    { key: 'ready_for_dispatch', labelKn: 'ರವಾನೆಗೆ ಸಿದ್ಧ', labelEn: 'Ready for Dispatch', color: '#9333EA' },
    { key: 'shipped', labelKn: 'ರವಾನಿಸಲಾಗಿದೆ', labelEn: 'Shipped', color: '#7C3AED' },
    { key: 'delivered', labelKn: 'ತಲುಪಿಸಲಾಗಿದೆ', labelEn: 'Delivered', color: '#059669' },
    { key: 'cancelled', labelKn: 'ರದ್ದುಗೊಂಡಿದೆ', labelEn: 'Cancelled', color: '#DC2626' }
  ];

  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...Object.values(stageCounts), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {stages.map((st) => {
        const count = stageCounts[st.key] || 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
        const widthPct = Math.round((count / maxCount) * 100);

        return (
          <div key={st.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {isKn ? st.labelKn : st.labelEn}
              </span>
              <span style={{ color: 'var(--secondary-text)', fontWeight: 700 }}>
                {count} {isKn ? 'ಆರ್ಡರ್‌ಗಳು' : 'orders'} ({pct}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  background: st.color,
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Customer Ratings Distribution Bar Chart (1★ to 5★)
 */
export function RatingDistributionBarChart({ ratings = {}, isKn = false }) {
  const total = Object.values(ratings).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = ratings[stars] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem' }}>
            <span style={{ width: '32px', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center' }}>
              {stars}★
            </span>
            <div style={{ flex: 1, height: '8px', background: 'var(--border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: stars >= 4 ? '#059669' : stars === 3 ? '#D97706' : '#DC2626',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <span style={{ width: '45px', textAlign: 'right', fontWeight: 600, color: 'var(--secondary-text)' }}>
              {count} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Monthly Orders Trend Line Chart (SVG)
 */
export function MonthlyOrdersLineChart({ data = [], isKn = false }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--secondary-text)', fontSize: '0.85rem' }}>
        {isKn ? 'ಯಾವುದೇ ಮಾಸಿಕ ಆರ್ಡರ್ ಪ್ರವೃತ್ತಿ ಲಭ್ಯವಿಲ್ಲ' : 'No order trend history available'}
      </div>
    );
  }

  const chartWidth = 320;
  const chartHeight = 130;
  const maxVal = Math.max(...data.map(d => d.count), 5);
  const stepX = (chartWidth - 60) / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => {
    const x = 40 + i * stepX;
    const y = chartHeight + 10 - ((d.count / maxVal) * chartHeight);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${chartWidth + 20} ${chartHeight + 35}`}
        style={{ width: '100%', maxHeight: '180px', display: 'block' }}
        role="img"
        aria-label="Monthly Orders Trend Line Chart"
      >
        {/* Y Axis line */}
        <line x1="35" y1="10" x2="35" y2={chartHeight + 10} stroke="var(--border, #cbd5e1)" strokeWidth="1" />
        {/* X Axis line */}
        <line x1="35" y1={chartHeight + 10} x2={chartWidth + 10} y2={chartHeight + 10} stroke="var(--border, #cbd5e1)" strokeWidth="1" />

        {/* Path line */}
        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points & labels */}
        {points.map((pt, idx) => (
          <g key={idx}>
            <circle cx={pt.x} cy={pt.y} r="3.5" fill="#2563EB" stroke="#ffffff" strokeWidth="1.5" />
            <text x={pt.x} y={pt.y - 7} textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--text, #1e293b)">
              {pt.count}
            </text>
            <text x={pt.x} y={chartHeight + 24} textAnchor="middle" fontSize="8.5" fill="var(--secondary-text, #64748b)">
              {pt.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Enquiry-to-Order Conversion Rate KPI Card
 */
export function EnquiryConversionCard({ totalEnquiries = 0, confirmedOrders = 0, isKn = false }) {
  const rate = totalEnquiries > 0 ? ((confirmedOrders / totalEnquiries) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', textAlign: 'center' }}>
      <div style={{ padding: '0.65rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563EB' }}>{totalEnquiries}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
          {isKn ? 'ಒಟ್ಟು ವಿಚಾರಣೆಗಳು' : 'Total Enquiries'}
        </div>
      </div>
      <div style={{ padding: '0.65rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>{confirmedOrders}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
          {isKn ? 'ದೃಢೀಕರಿಸಿದ ಆರ್ಡರ್‌ಗಳು' : 'Confirmed Orders'}
        </div>
      </div>
      <div style={{ padding: '0.65rem', background: 'rgba(124, 58, 237, 0.08)', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7C3AED' }}>{rate}%</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
          {isKn ? 'ಪರಿವರ್ತನೆ ದರ' : 'Conversion Rate'}
        </div>
      </div>
    </div>
  );
}

