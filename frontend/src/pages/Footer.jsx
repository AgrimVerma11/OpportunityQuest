import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        
        <p>© 2026 Opportunity Quest. All rights reserved.</p>

        <div className="footer-links">
          <a href="mailto:masteragrim11@gmail.com">
            📧 Contact
          </a>

          <a 
            href="https://substack.com/@agrimverma" 
            target="_blank" 
            rel="noreferrer"
          >
            ✍️ Substack
          </a>
        </div>

      </div>
    </footer>
  );
}

export default Footer;