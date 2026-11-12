import fs from 'fs';
import path from 'path';

const file = path.resolve('artisan-assistant/src/pages/MyOrdersPage.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add useSearchParams
content = content.replace(
  "import { Link, useNavigate } from 'react-router-dom';",
  "import { Link, useNavigate, useSearchParams } from 'react-router-dom';"
);

// 2. Add ready_for_dispatch status config
if (!content.includes('ready_for_dispatch:')) {
  content = content.replace(
    "  preparing: {",
    "  ready_for_dispatch: {\n    labelKn: 'ರವಾನೆಗೆ ಸಿದ್ಧ',\n    labelEn: 'Ready for Dispatch',\n    bg: 'rgba(168, 85, 247, 0.12)',\n    color: '#9333EA',\n    border: 'rgba(168, 85, 247, 0.3)'\n  },\n  preparing: {"
  );
}

// 3. Add searchParams and orderChecklist
if (!content.includes('searchParams.get')) {
  content = content.replace(
    "  const { user, artisan, loading: authLoading } = useAuth();",
    "  const [searchParams] = useSearchParams();\n  const { user, artisan, loading: authLoading } = useAuth();"
  );

  content = content.replace(
    "  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'active' | 'delivered' | 'cancelled'",
    `  const [filterTab, setFilterTab] = useState(() => searchParams.get('tab') || 'all');
  const [orderChecklist, setOrderChecklist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('artisan_order_checklists') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setFilterTab(tabParam);
  }, [searchParams]);

  const toggleChecklistItem = (orderId, stepKey) => {
    setOrderChecklist((prev) => {
      const orderSteps = prev[orderId] || {};
      const updated = { ...prev, [orderId]: { ...orderSteps, [stepKey]: !orderSteps[stepKey] } };
      try {
        localStorage.setItem('artisan_order_checklists', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };`
  );
}

// 4. Update filteredOrders
if (!content.includes("filterTab === 'preparing'")) {
  content = content.replace(
    "  const filteredOrders = useMemo(() => {",
    `  const filteredOrders = useMemo(() => {
    if (filterTab === 'preparing') {
      return orders.filter((o) => ['confirmed', 'preparing'].includes(o.status));
    }
    if (filterTab === 'delivery') {
      return orders.filter((o) => ['ready_for_dispatch', 'shipped', 'out_for_delivery'].includes(o.status));
    }`
  );
}

// 5. Update tab buttons
if (!content.includes("id: 'preparing'")) {
  content = content.replace(
    "{ id: 'all', labelKn: 'ಎಲ್ಲಾ', labelEn: 'All', count: orders.length },",
    `{ id: 'all', labelKn: 'ಎಲ್ಲಾ', labelEn: 'All', count: orders.length },
          { id: 'preparing', labelKn: 'ಉತ್ಪಾದನೆ & ಸಿದ್ಧತೆ', labelEn: 'Production', count: orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length },
          { id: 'delivery', labelKn: 'ರವಾನೆ & ವಿತರಣೆ', labelEn: 'Delivery', count: orders.filter((o) => ['ready_for_dispatch', 'shipped', 'out_for_delivery'].includes(o.status)).length },`
  );
}

// 6. Add preparation checklist guidance UI inside order card
const checklistUI = `
                  {/* Workshop Production Guidance Checklist */}
                  {['confirmed', 'preparing'].includes(ord.status) && (
                    <div style={{ marginTop: '0.65rem', padding: '0.65rem 0.85rem', background: 'rgba(234, 88, 12, 0.05)', borderRadius: '8px', border: '1px solid rgba(234, 88, 12, 0.2)', fontSize: '0.76rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <strong style={{ color: '#C2410C', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          🔨 {isKn ? 'ಉತ್ಪಾದನಾ ಹಂತಗಳು & ಮಾರ್ಗದರ್ಶಿ:' : 'Workshop Production Checklist:'}
                        </strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>
                          {Object.values(orderChecklist[ord.id] || {}).filter(Boolean).length}/5 {isKn ? 'ಪೂರ್ಣ' : 'done'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {[
                          { key: 'specs', kn: '1. ಉತ್ಪನ್ನ ವಿವರ & ಗ್ರಾಹಕರ ಅಗತ್ಯತೆ ಪರಿಶೀಲನೆ', en: '1. Review design requirements & customer notes' },
                          { key: 'materials', kn: '2. ಕಚ್ಚಾ ಸಾಮಗ್ರಿಗಳ ಖಚಿತತೆ & ಲಭ್ಯತೆ', en: '2. Verify raw materials & craft supplies' },
                          { key: 'crafting', kn: '3. ಕರಕುಶಲ ಕೃತಿ ತಯಾರಿಕೆ ಪ್ರಗತಿಯಲ್ಲಿದೆ', en: '3. Handcrafting agreed quantity in workshop' },
                          { key: 'quality', kn: '4. ಗುಣಮಟ್ಟ ಪರಿಶೀಲನೆ & ಅಂತಿಮ ಫಿನಿಶಿಂಗ್', en: '4. Quality inspection & fine artisan finish' },
                          { key: 'packaging', kn: '5. ಸುರಕ್ಷಿತ ಪರಿಸರ ಸ್ನೇಹಿ ಪ್ಯಾಕಿಂಗ್ ಪೂರ್ಣ', en: '5. Secure eco-friendly craft packaging' }
                        ].map((step) => {
                          const isDone = !!(orderChecklist[ord.id]?.[step.key]);
                          return (
                            <label key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', color: isDone ? '#059669' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => toggleChecklistItem(ord.id, step.key)}
                                style={{ cursor: 'pointer', accentColor: '#059669' }}
                              />
                              <span>{isKn ? step.kn : step.en}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
`;

if (!content.includes('Workshop Production Checklist:')) {
  content = content.replace(
    "{/* Status Action Buttons (Matching authorized workflow in Dashboard.jsx) */}",
    `${checklistUI}\n                  {/* Status Action Buttons (Matching authorized workflow in Dashboard.jsx) */}`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated MyOrdersPage.jsx');

