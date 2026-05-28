import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateOpportunity.css";
import { postWithAuth } from "../utils/api";
import Navbar from "./Navbar";

function CreateOpportunity() {

  const navigate = useNavigate();

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

  const [error, setError] = useState("");

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

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleMultiSelect = (field, value) => {

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
        ? current.filter((v) => v !== value)
        : [...current, value];
    }

    setForm({
      ...form,
      [field]: current,
    });
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

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

      if (res.message === "Server error") {
        setError("Failed to create opportunity");
        return;
      }

      const action = window.confirm(
        "Opportunity created successfully ✅\n\nPress OK to create another opportunity.\nPress Cancel to go back home."
      );

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

      } else {

        navigate("/home");

      }

    } catch (err) {

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

          <h2>Create Opportunity</h2>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          <input
            name="title"
            placeholder="Opportunity Title"
            value={form.title}
            onChange={handleChange}
          />

          <textarea
            name="description"
            placeholder="Describe the opportunity..."
            value={form.description}
            onChange={handleChange}
          />

          <select
            name="category"
            value={form.category}
            onChange={handleChange}
          >
            <option>Internship</option>
            <option>Research</option>
            <option>Paid Gig</option>
            <option>Faculty Project</option>
          </select>

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

          <input
            name="tags"
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={handleChange}
          />

          <button
            type="submit"
            className="submit-btn"
          >
            Create Opportunity
          </button>

        </form>
      </div>
    </>
  );
}

export default CreateOpportunity;