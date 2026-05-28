import Navbar from "./Navbar";

function Faculty() {
  return (
    <>
      <Navbar />
      <div style={{ padding: "60px", textAlign: "center" }}>
        <h2>Faculty Page</h2>
        <p>This page is currently under construction.</p>
        <p>It will be completed on <b>30th Feb, 2026</b></p> 
      </div>
    </>
  );
}

export default Faculty;

// user registers
// validity of email, validity of password is tetsted 
// password should be matching in the confirm password and password field
// after user registers, goes to login page.
// On login page, - validity of email (thapar.edu) and the password length verification
// IMPORTANT - it checks the register credentials and based on those, login is validated 
// On correct login, the user goes to the home page
// then user can segregate using tags 
// abhi add and show interest is not added but vo abhi dalna hai , also the faculty page me faculty details dalni hai
// add the thing about 