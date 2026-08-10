import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import { IconMail } from "../components/Icons";
import "./Footer.css";

const CONTACT = "masteragrim11@gmail.com";

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/AgrimVerma11" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/agrimverma11" },
  { label: "Substack", href: "https://substack.com/@agrimverma" },
];

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo className="footer-mark" size={34} />
            <div className="footer-brand-text">
              <div className="footer-wordmark">
                Opportunity
                <span className="footer-quest">QUEST</span>
              </div>
              <p className="footer-tagline">
                Connecting students with faculty-posted internships, research
                projects, and paid work, all in one place.
              </p>
              <a className="footer-contact" href={`mailto:${CONTACT}`}>
                <IconMail /> {CONTACT}
              </a>
            </div>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <h4 className="footer-heading">Explore</h4>
              <Link to="/home">Home</Link>
              <Link to="/profile">My profile</Link>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Connect</h4>
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Agrim Verma · All rights reserved.
          </span>
          <span>Built for students, by a student.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
