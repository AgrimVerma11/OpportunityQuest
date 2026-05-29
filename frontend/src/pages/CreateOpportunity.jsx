import { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";

import "./CreateOpportunity.css";

import { postWithAuth } from "../utils/api";

import Navbar from "./Navbar";



function CreateOpportunity() {

  const navigate = useNavigate();

  // =========================
  // CURRENT USER
  // =========================

  const currentUser = JSON.parse(
    localStorage.getItem("currentUser")
  );



  // =========================
  // ROLE PROTECTION
  // =========================

  useEffect(() => {

    if (
      !currentUser ||
      currentUser.role !== "Faculty"
    ) {

      navigate("/home");

    }

  }, []);




  // =========================
  // FORM STATE
  // =========================

  const [form, setForm] = useState({

    title: "",

    description: "",

    category: "Internship",

    contactEmail: "",

    eligibleBranches: [],

    eligibleYears: [],

    eligibleGender: "Any",

    tags: "",

    deadline: "",

  });



  const [error, setError] =
    useState("");



  // =========================
  // OPTIONS
  // =========================

  const branches = [

    "All",

    "COE",

    "ENC",

    "ECE",

    "RAI",

    "COBS",

    "EEC",

  ];



  const years = [

    "All",

    "1",

    "2",

    "3",

    "4",

  ];



  // =========================
  // INPUT CHANGE
  // =========================

  const handleChange = (e) => {

    setForm({

      ...form,

      [e.target.name]: e.target.value,

    });

  };



  // =========================
  // MULTI SELECT
  // =========================

  const handleMultiSelect = (
    field,
    value
  ) => {

    let current = [...form[field]];

    // ALL LOGIC
    if (value === "All") {

      current =
        current.includes("All")
          ? []
          : ["All"];

    } else {

      current = current.filter(
        (v) => v !== "All"
      );

      current = current.includes(value)

        ? current.filter(
            (v) => v !== value
          )

        : [...current, value];
    }

    setForm({

      ...form,

      [field]: current,

    });
  };



  // =========================
  // SUBMIT
  // =========================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");



    // BASIC VALIDATION
    if (

      !form.title ||

      !form.description ||

      !form.contactEmail ||

      !form.deadline

    ) {

      setError(
        "Please fill all required fields"
      );

      return;
    }



    try {

      const payload = {

        ...form,

        tags: form.tags

          .split(",")

          .map((t) => t.trim())

          .filter((t) => t !== ""),

      };



      const res = await postWithAuth(

        "/opportunities/create",

        payload
      );



      // FAILED
      if (!res.success) {

        setError(
          res.message ||
          "Failed to create opportunity"
        );

        return;
      }



      // SUCCESS FLOW
      const action = window.confirm(

        "Opportunity created successfully ✅\n\nPress OK to create another opportunity.\nPress Cancel to go back home."

      );



      // CREATE ANOTHER
      if (action) {

        setForm({

          title: "",

          description: "",

          category: "Internship",

          contactEmail: "",

          eligibleBranches: [],

          eligibleYears: [],

          eligibleGender: "Any",

          tags: "",

          deadline: "",

        });

      }

      // HOME
      else {

        navigate("/faculty");

      }

    } catch (err) {

      console.error(err);

      setError(
        "Something went wrong"
      );

    }
  };



  return (

    <>

      <Navbar />



      <div className="create-container">

        <form
          className="create-card"
          onSubmit={handleSubmit}
        >

          {/* HEADER */}

          <div className="create-header">

            <h2>
              Create Opportunity
            </h2>

            <p className="create-subtitle">

              Publish internships,
              research work,
              paid gigs and collaborations
              across campus.

            </p>

          </div>



          {/* ERROR */}

          {error && (

            <p className="error">
              {error}
            </p>

          )}



          {/* TITLE */}

          <input

            name="title"

            placeholder="Opportunity Title"

            value={form.title}

            onChange={handleChange}

          />



          {/* DESCRIPTION */}

          <textarea

            name="description"

            placeholder="Describe the opportunity..."

            value={form.description}

            onChange={handleChange}

          />



          {/* CATEGORY */}

          <select

            name="category"

            value={form.category}

            onChange={handleChange}

          >

            <option>
              Internship
            </option>

            <option>
              Research
            </option>

            <option>
              Paid Gig
            </option>

            <option>
              Faculty Project
            </option>

          </select>



          {/* EMAIL */}

          <input

            type="email"

            name="contactEmail"

            placeholder="Contact Email"

            value={form.contactEmail}

            onChange={handleChange}

          />



          {/* DEADLINE */}

          <input

            type="date"

            name="deadline"

            value={form.deadline}

            onChange={handleChange}

          />



          {/* BRANCHES */}

          <div className="multi-section">

            <label>
              Eligible Branches
            </label>

            <div className="multi-options">

              {branches.map((b) => (

                <button

                  type="button"

                  key={b}

                  className={
                    form.eligibleBranches.includes(b)
                      ? "selected"
                      : ""
                  }

                  onClick={() =>
                    handleMultiSelect(
                      "eligibleBranches",
                      b
                    )
                  }
                >

                  {b}

                </button>

              ))}

            </div>

          </div>



          {/* YEARS */}

          <div className="multi-section">

            <label>
              Eligible Years
            </label>

            <div className="multi-options">

              {years.map((y) => (

                <button

                  type="button"

                  key={y}

                  className={
                    form.eligibleYears.includes(y)
                      ? "selected"
                      : ""
                  }

                  onClick={() =>
                    handleMultiSelect(
                      "eligibleYears",
                      y
                    )
                  }
                >

                  {y === "All"
                    ? "All"
                    : `${y} Year`}

                </button>

              ))}

            </div>

          </div>



          {/* GENDER */}

          <select

            name="eligibleGender"

            value={form.eligibleGender}

            onChange={handleChange}

          >

            <option value="Any">
              Any
            </option>

            <option value="Male">
              Male
            </option>

            <option value="Female">
              Female
            </option>

          </select>



          {/* TAGS */}

          <input

            name="tags"

            placeholder="Tags (comma separated)"

            value={form.tags}

            onChange={handleChange}

          />



          {/* SUBMIT */}

          <button
            type="submit"
            className="submit-btn"
          >

            Publish Opportunity

          </button>

        </form>

      </div>

    </>
  );
}

export default CreateOpportunity;