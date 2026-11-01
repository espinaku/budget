function FormField({label, error, children}) {
  return (
      <div className="form-field">
        {label && <label>{label}</label>}
        {children}
        {error && <span className="form-field-error">{error}</span>}
      </div>
  );
}

export default FormField;