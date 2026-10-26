import { useRef, useState } from "react";
import Icon from "./Icon.jsx";
import ProfileAvatar from "./ProfileAvatar.jsx";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_CROP = { zoom: 1, x: 50, y: 50 };

export default function ProfilePhotoField({ name, photo, photoCrop = DEFAULT_CROP, onChange, onChangeCrop }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const cropSettings = { ...DEFAULT_CROP, ...photoCrop };

  function updateCrop(key, value) {
    onChangeCrop({ ...cropSettings, [key]: value });
  }

  function readPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("A foto deve ter no máximo 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
        onChangeCrop(DEFAULT_CROP);
      } else {
        setError("Não foi possível abrir essa imagem. Tente outra.");
      }
    };
    reader.onerror = () => setError("Não foi possível abrir essa imagem. Tente outra.");
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    onChange("");
    onChangeCrop(DEFAULT_CROP);
    setError("");
  }

  return (
    <div className="profile-photo-field">
      <ProfileAvatar name={name} photo={photo} size="large" photoCrop={cropSettings} />
      <div className="profile-photo-field__controls">
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Escolher foto de perfil"
          onChange={readPhoto}
        />
        <button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()}>
          <Icon name="camera" />
          {photo ? "Trocar foto" : "Adicionar foto"}
        </button>
        <small>JPG, PNG ou WebP · até 2 MB</small>
        {photo && (
          <div className="photo-adjustments">
            <label>
              Aproximar
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={cropSettings.zoom}
                onChange={(event) => updateCrop("zoom", Number(event.target.value))}
              />
            </label>
            <label>
              Ajustar horizontalmente
              <input
                type="range"
                min="0"
                max="100"
                value={cropSettings.x}
                onChange={(event) => updateCrop("x", Number(event.target.value))}
              />
            </label>
            <label>
              Ajustar verticalmente
              <input
                type="range"
                min="0"
                max="100"
                value={cropSettings.y}
                onChange={(event) => updateCrop("y", Number(event.target.value))}
              />
            </label>
            <button className="text-button photo-reset" type="button" onClick={() => onChangeCrop(DEFAULT_CROP)}>
              Restaurar enquadramento
            </button>
          </div>
        )}
        {error && <span className="profile-photo-error" role="alert">{error}</span>}
        {photo && <button className="text-button" type="button" onClick={removePhoto}>Remover foto</button>}
      </div>
    </div>
  );
}
