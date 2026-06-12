import { useNavigate } from "react-router-dom";
import "./Footer.css";

function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">

          {/* Brand */}
          <div>
            <div className="footer-brand-logo">
              <div className="footer-logo-badge">OQ</div>
              <span className="footer-brand-name">Opportunity Quest</span>
            </div>
            <p className="footer-tagline">
              Connecting students with faculty-posted internships,
              research projects, and paid gigs — all in one place.
            </p>
          </div>

          {/* Navigation */}
          <div className="footer-col">
            <h4>Navigate</h4>
            <ul>
              <li><a onClick={() => navigate("/home")}>Home</a></li>
              <li><a onClick={() => navigate("/faculty")}>Faculty Corner</a></li>
              <li><a onClick={() => navigate("/profile")}>My Profile</a></li>
              <li><a onClick={() => navigate("/create-opportunity")}>Post Opportunity</a></li>
            </ul>
          </div>

          {/* Creator */}
          <div className="footer-col">
            <h4>Creator</h4>
            <ul>
              <li>
                <a href="mailto:masteragrim11@gmail.com">
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/AgrimVerma11"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/agrimverma11"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://substack.com/@agrimverma"
                  target="_blank"
                  rel="noreferrer"
                >
                  Substack
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Agrim Verma · All rights reserved.</span>
          <span>Built for students, by a student</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
