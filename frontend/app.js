const API_URL = "";

function login() {

    const username = document.getElementById("username").value;

    if (!username) {
        alert("Please enter a username");
        return;
    }

    fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username
        })
    })
    .then(res => res.json())
    .then(data => {

        localStorage.setItem("username", username);

        window.location.href = "index.html";
    })
    .catch(err => {
        console.log(err);
        alert("Login failed");
    });
}

function uploadPhoto() {

    const fileInput = document.getElementById("photoInput");

    if (!fileInput.files[0]) {
        alert("Please select a photo");
        return;
    }

    const formData = new FormData();

    formData.append("photo", fileInput.files[0]);

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {

        console.log(data);

        loadPhotos();
    })
    .catch(err => {
        console.log(err);
        alert("Upload failed");
    });
}

function loadPhotos() {

    fetch("/photos")
    .then(res => res.json())
    .then(data => {

        const gallery = document.getElementById("gallery");

        gallery.innerHTML = "";

        data.forEach(photo => {

            const img = document.createElement("img");

            img.src = `/uploads/${photo.filename}`;

            gallery.appendChild(img);
        });
    })
    .catch(err => {
        console.log(err);
        alert("Failed to load photos");
    });
}

if (document.getElementById("gallery")) {
    loadPhotos();
}