import { Link } from "react-router-dom";

function Placeholder({ title }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{title}</h1>
      <p>This page is a placeholder for future functionality.</p>
      <Link to="/" style={{ marginTop: "1rem", display: "inline-block" }}>
        Back to Home
      </Link>
    </div>
  );
}

export default Placeholder;
