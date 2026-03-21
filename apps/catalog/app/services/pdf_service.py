import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.user import MealPlan

# Brand colors
NUTRIA_GREEN = colors.HexColor("#2E7D32")
NUTRIA_LIGHT_GREEN = colors.HexColor("#E8F5E9")
HEADER_BG = colors.HexColor("#1B5E20")
ROW_ALT = colors.HexColor("#F1F8E9")


def _get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "PDFTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=NUTRIA_GREEN,
        spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        "PDFSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=6 * mm,
    ))
    styles.add(ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=NUTRIA_GREEN,
        spaceBefore=6 * mm,
        spaceAfter=3 * mm,
    ))
    styles.add(ParagraphStyle(
        "MealHeading",
        parent=styles["Heading3"],
        fontSize=11,
        textColor=colors.HexColor("#33691E"),
        spaceBefore=4 * mm,
        spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.grey,
        alignment=1,
    ))

    return styles


def _table_style(has_total_row: bool = False, row_count: int = 0):
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.Color(0.85, 0.85, 0.85)),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]

    # Alternate row colors
    for i in range(1, row_count):
        if i % 2 == 0:
            style_commands.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))

    if has_total_row and row_count > 1:
        last = row_count - 1
        style_commands.extend([
            ("BACKGROUND", (0, last), (-1, last), NUTRIA_LIGHT_GREEN),
            ("FONTNAME", (0, last), (-1, last), "Helvetica-Bold"),
            ("LINEABOVE", (0, last), (-1, last), 1, NUTRIA_GREEN),
        ])

    return TableStyle(style_commands)


def _safe_get(d: dict, keys: list, default=None):
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default if default is not None else ""


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _format_num(value, decimals: int = 1) -> str:
    f = _safe_float(value)
    if f == int(f):
        return str(int(f))
    return f"{f:.{decimals}f}"


def generate_meal_plan_pdf(meal_plan: MealPlan) -> bytes:
    buffer = io.BytesIO()
    styles = _get_styles()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
    )

    elements = []

    # Header
    elements.append(Paragraph("NUTRIA - Plano Alimentar", styles["PDFTitle"]))
    elements.append(Paragraph(
        f"{meal_plan.plan_name}",
        ParagraphStyle("PlanName", parent=styles["Normal"], fontSize=14, textColor=colors.HexColor("#424242")),
    ))

    if meal_plan.description:
        elements.append(Spacer(1, 2 * mm))
        elements.append(Paragraph(meal_plan.description, styles["Normal"]))

    elements.append(Spacer(1, 2 * mm))

    created_at_str = ""
    if meal_plan.created_at:
        created_at_str = meal_plan.created_at.strftime("%d/%m/%Y %H:%M")

    created_by_label = "IA" if meal_plan.created_by in ("ai", "system") else "Usuário"
    elements.append(Paragraph(
        f"Criado em: {created_at_str} | Criado por: {created_by_label}",
        styles["PDFSubtitle"],
    ))

    # Daily targets table
    elements.append(Paragraph("Metas Diárias", styles["SectionHeading"]))

    targets_data = [
        ["Calorias (kcal)", "Proteína (g)", "Carboidratos (g)", "Gordura (g)"],
        [
            _format_num(meal_plan.daily_calories, 0),
            _format_num(meal_plan.daily_protein_g),
            _format_num(meal_plan.daily_carbs_g),
            _format_num(meal_plan.daily_fat_g),
        ],
    ]

    targets_table = Table(targets_data, colWidths=[4 * cm, 4 * cm, 4 * cm, 4 * cm])
    targets_table.setStyle(_table_style(row_count=2))
    elements.append(targets_table)

    # Meals
    meals = meal_plan.meals or []
    if meals:
        elements.append(Paragraph("Refeições", styles["SectionHeading"]))

        for i, meal in enumerate(meals):
            meal_name = _safe_get(meal, ["meal_name", "name", "meal_type"], f"Refeição {i + 1}")
            elements.append(Paragraph(f"{meal_name}", styles["MealHeading"]))

            foods = meal.get("foods", meal.get("items", []))
            if not isinstance(foods, list):
                foods = []

            if not foods:
                elements.append(Paragraph("Nenhum alimento registrado.", styles["Normal"]))
                elements.append(Spacer(1, 2 * mm))
                continue

            table_data = [["Alimento", "Qtd (g)", "Kcal", "Prot (g)", "Carb (g)", "Gord (g)"]]

            total_kcal = 0.0
            total_prot = 0.0
            total_carb = 0.0
            total_fat = 0.0

            for food in foods:
                name = _safe_get(food, ["name", "food_name", "description"], "—")
                qty = _safe_float(_safe_get(food, ["quantity_g", "quantity", "amount", "grams"], 0))
                kcal = _safe_float(_safe_get(food, ["calories", "kcal", "energy_kcal"], 0))
                prot = _safe_float(_safe_get(food, ["protein_g", "protein", "prot"], 0))
                carb = _safe_float(_safe_get(food, ["carbs_g", "carbohydrates_g", "carbs", "carbohydrates"], 0))
                fat = _safe_float(_safe_get(food, ["fat_g", "fat", "lipids_g", "lipids"], 0))

                total_kcal += kcal
                total_prot += prot
                total_carb += carb
                total_fat += fat

                table_data.append([
                    Paragraph(str(name), ParagraphStyle("Cell", fontSize=8)),
                    _format_num(qty, 0),
                    _format_num(kcal, 0),
                    _format_num(prot),
                    _format_num(carb),
                    _format_num(fat),
                ])

            # Total row
            table_data.append([
                "TOTAL",
                "",
                _format_num(total_kcal, 0),
                _format_num(total_prot),
                _format_num(total_carb),
                _format_num(total_fat),
            ])

            col_widths = [5.5 * cm, 2 * cm, 2 * cm, 2.3 * cm, 2.3 * cm, 2.3 * cm]
            meal_table = Table(table_data, colWidths=col_widths)
            meal_table.setStyle(_table_style(has_total_row=True, row_count=len(table_data)))
            elements.append(meal_table)
            elements.append(Spacer(1, 3 * mm))
    else:
        elements.append(Spacer(1, 4 * mm))
        elements.append(Paragraph("Nenhuma refeição definida neste plano.", styles["Normal"]))

    # Footer
    elements.append(Spacer(1, 10 * mm))
    now_str = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
    elements.append(Paragraph(
        f"Gerado em {now_str} — Nutria · Assistente Nutricional com IA",
        styles["FooterStyle"],
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
