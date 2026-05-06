/**
 * Bilingual industry list for the tenant industry-vertical autocomplete.
 *
 * Single source of truth for both the visible labels (EN + ES) and the
 * underlying enum codes (which match Prisma's IndustryVertical enum).
 * Kept out of the i18n dictionaries on purpose — adding an industry
 * shouldn't require touching two JSON files.
 *
 * Sorted alphabetically by English label. Keep it that way when editing
 * — the autocomplete relies on a stable order for keyboard navigation.
 *
 * `searchTerms` is optional extra text the autocomplete matches against
 * (synonyms, parenthesized variants, common typos). Not displayed.
 */

export interface Industry {
  /** Matches a value in the IndustryVertical Prisma enum. */
  code: string
  /** Display label (English). First-letter-capitalized sentence case. */
  labelEn: string
  /** Display label (Spanish, Latin American, informal "tú"). */
  labelEs: string
  /** Optional extra terms the autocomplete filter matches but doesn't show. */
  searchTerms?: string
}

export const INDUSTRIES: readonly Industry[] = [
  { code: 'ACCOUNTING',              labelEn: 'Accounting firms',                       labelEs: 'Contabilidad' },
  { code: 'APPLIANCE_REPAIR',        labelEn: 'Appliance repair',                       labelEs: 'Reparación de electrodomésticos' },
  { code: 'ARCHITECTURE',            labelEn: 'Architecture and design',                labelEs: 'Arquitectura y diseño' },
  { code: 'ASSISTED_LIVING',         labelEn: 'Assisted living communities',            labelEs: 'Residencias asistidas' },
  { code: 'AUTO_DEALERSHIP',         labelEn: 'Auto dealerships',                       labelEs: 'Concesionarios de autos' },
  { code: 'AUTO_REPAIR',             labelEn: 'Auto repair shops',                      labelEs: 'Talleres mecánicos' },
  { code: 'BEAUTY',                  labelEn: 'Beauty and wellness',                    labelEs: 'Belleza y bienestar' },
  { code: 'BOOKKEEPING',             labelEn: 'Bookkeepers',                            labelEs: 'Tenedores de libros' },
  { code: 'CAFE',                    labelEn: 'Cafés',                                  labelEs: 'Cafeterías' },
  { code: 'CHILDCARE',               labelEn: 'Childcare and daycare',                  labelEs: 'Cuidado infantil y guardería' },
  { code: 'CHIROPRACTIC',            labelEn: 'Chiropractic',                           labelEs: 'Quiropráctica' },
  { code: 'CLEANING_SERVICE',        labelEn: 'Cleaning services',                      labelEs: 'Servicios de limpieza' },
  { code: 'COACHING',                labelEn: 'Coaching',                               labelEs: 'Coaching' },
  { code: 'CONSTRUCTION',            labelEn: 'Construction and general contractors',   labelEs: 'Construcción y contratistas generales' },
  { code: 'CONSULTING',              labelEn: 'Consulting',                             labelEs: 'Consultoría' },
  { code: 'COURIER',                 labelEn: 'Courier services',                       labelEs: 'Servicios de mensajería' },
  { code: 'CUSTOMER_SUPPORT_CENTER', labelEn: 'Customer support centers',               labelEs: 'Centros de atención al cliente' },
  { code: 'DENTAL',                  labelEn: 'Dental offices',                         labelEs: 'Consultorios dentales' },
  { code: 'ECOMMERCE',               labelEn: 'E-commerce and online retailers',        labelEs: 'Comercio electrónico y tiendas en línea', searchTerms: 'online shop ecommerce' },
  { code: 'EDUCATION',               labelEn: 'Education services',                     labelEs: 'Servicios educativos' },
  { code: 'ELECTRICIAN',             labelEn: 'Electricians',                           labelEs: 'Electricistas' },
  { code: 'EVENT_PLANNING',          labelEn: 'Event planning',                         labelEs: 'Planeación de eventos' },
  { code: 'FINANCIAL',               labelEn: 'Financial services',                     labelEs: 'Servicios financieros' },
  { code: 'FINANCIAL_ADVISORY',      labelEn: 'Financial advisors',                     labelEs: 'Asesores financieros' },
  { code: 'FITNESS',                 labelEn: 'Fitness and gym',                        labelEs: 'Fitness y gimnasios' },
  { code: 'FOOD_SERVICE_GROUP',      labelEn: 'Food service groups (multi-location)',   labelEs: 'Grupos de servicio de comida (multi-sucursal)' },
  { code: 'FUNERAL_HOME',            labelEn: 'Funeral homes',                          labelEs: 'Funerarias' },
  { code: 'GENERAL',                 labelEn: 'General',                                labelEs: 'General' },
  { code: 'HEALTHCARE_CLINICS',      labelEn: 'Healthcare clinics and medical offices', labelEs: 'Clínicas y consultorios médicos' },
  { code: 'HOME_SERVICES',           labelEn: 'Home services',                          labelEs: 'Servicios para el hogar' },
  { code: 'HOSPITALITY',             labelEn: 'Hospitality businesses',                 labelEs: 'Negocios de hospitalidad' },
  { code: 'HOTEL',                   labelEn: 'Hotels',                                 labelEs: 'Hoteles' },
  { code: 'HVAC',                    labelEn: 'HVAC companies',                         labelEs: 'Empresas de HVAC (climatización)', searchTerms: 'heating cooling air conditioning calefacción aire acondicionado' },
  { code: 'INSURANCE',               labelEn: 'Insurance agencies',                     labelEs: 'Agencias de seguros' },
  { code: 'IT_SERVICES',             labelEn: 'IT services',                            labelEs: 'Servicios de TI', searchTerms: 'managed services tecnología información' },
  { code: 'LANDSCAPING',             labelEn: 'Landscaping',                            labelEs: 'Jardinería y paisajismo' },
  { code: 'LEGAL',                   labelEn: 'Law firms and legal services',           labelEs: 'Bufetes y servicios legales' },
  { code: 'LEASING_OFFICE',          labelEn: 'Leasing offices',                        labelEs: 'Oficinas de arrendamiento' },
  { code: 'LOGISTICS',               labelEn: 'Logistics',                              labelEs: 'Logística' },
  { code: 'MANUFACTURING',           labelEn: 'Manufacturing',                          labelEs: 'Manufactura' },
  { code: 'MARKETING_AGENCY',        labelEn: 'Marketing agencies',                     labelEs: 'Agencias de marketing' },
  { code: 'MEDICAL',                 labelEn: 'Medical offices',                        labelEs: 'Consultorios médicos' },
  { code: 'MENTAL_HEALTH',           labelEn: 'Mental health and therapy',              labelEs: 'Salud mental y terapia' },
  { code: 'MORTGAGE_LENDING',        labelEn: 'Mortgage and lending offices',           labelEs: 'Oficinas hipotecarias y de préstamos' },
  { code: 'MOTEL',                   labelEn: 'Motels',                                 labelEs: 'Moteles' },
  { code: 'NONPROFIT',               labelEn: 'Nonprofits and community organizations', labelEs: 'Organizaciones sin fines de lucro y comunitarias' },
  { code: 'NURSING_HOME',            labelEn: 'Nursing homes',                          labelEs: 'Hogares de ancianos' },
  { code: 'OPTOMETRY',               labelEn: 'Optometry and eyecare',                  labelEs: 'Optometría y cuidado visual' },
  { code: 'ORAL_SURGERY',            labelEn: 'Oral surgery practices',                 labelEs: 'Cirugía oral' },
  { code: 'ORTHODONTICS',            labelEn: 'Orthodontists',                          labelEs: 'Ortodoncistas' },
  { code: 'PERSONAL_TRAINER',        labelEn: 'Personal trainers',                      labelEs: 'Entrenadores personales' },
  { code: 'PEST_CONTROL',            labelEn: 'Pest control',                           labelEs: 'Control de plagas' },
  { code: 'PET_GROOMING',            labelEn: 'Pet grooming and boarding',              labelEs: 'Estética y hospedaje de mascotas' },
  { code: 'PHARMACY',                labelEn: 'Pharmacies',                             labelEs: 'Farmacias' },
  { code: 'PHOTOGRAPHY',             labelEn: 'Photography studios',                    labelEs: 'Estudios de fotografía' },
  { code: 'PHYSICAL_THERAPY',        labelEn: 'Physical therapy',                       labelEs: 'Terapia física' },
  { code: 'PLUMBING',                labelEn: 'Plumbers',                               labelEs: 'Plomeros' },
  { code: 'PROPERTY_MANAGEMENT',     labelEn: 'Property managers',                      labelEs: 'Administradores de propiedades' },
  { code: 'REAL_ESTATE',             labelEn: 'Real estate brokerages',                 labelEs: 'Agencias de bienes raíces' },
  { code: 'REALTOR',                 labelEn: 'Realtors',                               labelEs: 'Agentes inmobiliarios' },
  { code: 'RESORT',                  labelEn: 'Resorts',                                labelEs: 'Resorts' },
  { code: 'RESTAURANT',              labelEn: 'Restaurants',                            labelEs: 'Restaurantes' },
  { code: 'RESTORATION',             labelEn: 'Restoration services',                   labelEs: 'Servicios de restauración' },
  { code: 'RETAIL',                  labelEn: 'Retail stores',                          labelEs: 'Tiendas minoristas' },
  { code: 'ROOFING',                 labelEn: 'Roofers',                                labelEs: 'Techadores' },
  { code: 'SALON',                   labelEn: 'Salons',                                 labelEs: 'Salones de belleza' },
  { code: 'SCHOOL',                  labelEn: 'Schools',                                labelEs: 'Escuelas' },
  { code: 'SENIOR_LIVING',           labelEn: 'Senior living facilities',               labelEs: 'Residencias para adultos mayores' },
  { code: 'SPA',                     labelEn: 'Spas',                                   labelEs: 'Spas' },
  { code: 'TAX_PREPARATION',         labelEn: 'Tax preparers',                          labelEs: 'Preparadores de impuestos' },
  { code: 'TIRE_SHOP',               labelEn: 'Tire shops',                             labelEs: 'Llanteras' },
  { code: 'TOWING',                  labelEn: 'Towing companies',                       labelEs: 'Compañías de grúas' },
  { code: 'TRADES_OTHER',            labelEn: 'Trades, other',                          labelEs: 'Otros oficios' },
  { code: 'TRAINING_CENTER',         labelEn: 'Training centers',                       labelEs: 'Centros de capacitación' },
  { code: 'TRAVEL_AGENCY',           labelEn: 'Travel agencies and tour operators',     labelEs: 'Agencias de viajes y operadores turísticos' },
  { code: 'TRUCKING',                labelEn: 'Trucking',                               labelEs: 'Transporte de carga' },
  { code: 'TUTORING',                labelEn: 'Tutoring centers',                       labelEs: 'Centros de tutoría' },
  { code: 'VETERINARY',              labelEn: 'Veterinary clinics',                     labelEs: 'Clínicas veterinarias' },
  { code: 'WAREHOUSING',             labelEn: 'Warehousing and distribution',           labelEs: 'Almacenamiento y distribución' },
  { code: 'WELLNESS_CLINIC',         labelEn: 'Wellness clinics',                       labelEs: 'Clínicas de bienestar' },
]

/** Look up a single industry by enum code. Falls back to GENERAL if missing. */
export function findIndustry(code: string | null | undefined): Industry {
  return INDUSTRIES.find(i => i.code === code) ?? INDUSTRIES.find(i => i.code === 'GENERAL')!
}

/** Locale-aware label for a code. */
export function industryLabel(code: string | null | undefined, locale: 'en' | 'es'): string {
  const ind = findIndustry(code)
  return locale === 'es' ? ind.labelEs : ind.labelEn
}
