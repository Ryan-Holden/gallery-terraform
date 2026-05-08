const API_URL = "http://YOUR_VM_EXTERNAL_IP:3000";

function login() {

    const username = document.getElementById("username").value;

    fetch(`${API_URL}/login`, {
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
    });
}

function uploadPhoto() {

    const fileInput = document.getElementById("photoInput");

    const formData = new FormData();

    formData.append("photo", fileInput.files[0]);

    fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        loadPhotos();
    });
}

function loadPhotos() {

    fetch(`${API_URL}/photos`)
    .then(res => res.json())
    .then(data => {

        const gallery = document.getElementById("gallery");

        gallery.innerHTML = "";

        data.forEach(photo => {

            const img = document.createElement("img");

            img.src = `${API_URL}/uploads/${photo.filename}`;

            gallery.appendChild(img);
        });
    });
}

if (document.getElementById("gallery")) {
    loadPhotos();
}