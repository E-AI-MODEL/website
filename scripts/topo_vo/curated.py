"""Handmatig samengestelde gegevens voor TOPO VO.

Coördinaten zijn [lengtegraad, breedtegraad] (WGS84), afgerond. Bij handmatige
punten is de nauwkeurigheid ongeveer 1-3 km voor steden en een representatief
punt voor gebieden en wateren (veld 'punt': 'benadering').
"""

# ---------------------------------------------------------------- Nederland
# (naam, type, lon, lat, extra)  extra: dict met o.a. alt, slo
NL = [
    # steden (allemaal op de SLO-basislijst tenzij slo=False)
    ("'s-Hertogenbosch", "stad", 5.304, 51.690, {"alt": ["Den Bosch"], "provincie": "Noord-Brabant", "provinciehoofdstad": True}),
    ("Gouda", "stad", 4.708, 52.012, {"provincie": "Zuid-Holland"}),
    ("Alkmaar", "stad", 4.748, 52.632, {"provincie": "Noord-Holland"}),
    ("Groningen", "stad", 6.567, 53.219, {"slonaam": "Groningen (stad)", "provincie": "Groningen", "provinciehoofdstad": True}),
    ("Roermond", "stad", 5.988, 51.194, {"provincie": "Limburg"}),
    ("Almelo", "stad", 6.663, 52.357, {"provincie": "Overijssel"}),
    ("Haarlem", "stad", 4.636, 52.381, {"provincie": "Noord-Holland", "provinciehoofdstad": True}),
    ("Roosendaal", "stad", 4.465, 51.531, {"provincie": "Noord-Brabant"}),
    ("Almere", "stad", 5.215, 52.371, {"provincie": "Flevoland"}),
    ("Rotterdam", "stad", 4.479, 51.922, {"provincie": "Zuid-Holland"}),
    ("Alphen aan den Rijn", "stad", 4.658, 52.129, {"provincie": "Zuid-Holland"}),
    ("Heerenveen", "stad", 5.920, 52.959, {"provincie": "Fryslân"}),
    ("Heerlen", "stad", 5.981, 50.888, {"provincie": "Limburg"}),
    ("Amersfoort", "stad", 5.388, 52.156, {"provincie": "Utrecht"}),
    ("Helmond", "stad", 5.661, 51.481, {"provincie": "Noord-Brabant"}),
    ("Sneek", "stad", 5.659, 53.033, {"alt": ["Snits"], "provincie": "Fryslân"}),
    ("Amstelveen", "stad", 4.860, 52.304, {"provincie": "Noord-Holland"}),
    ("Hengelo", "stad", 6.793, 52.266, {"provincie": "Overijssel"}),
    ("Terneuzen", "stad", 3.828, 51.336, {"provincie": "Zeeland"}),
    ("Amsterdam", "hoofdstad", 4.900, 52.373, {"provincie": "Noord-Holland", "hoofdstad": True}),
    ("Hilversum", "stad", 5.176, 52.223, {"provincie": "Noord-Holland"}),
    ("Hoogeveen", "stad", 6.477, 52.723, {"provincie": "Drenthe"}),
    ("Apeldoorn", "stad", 5.969, 52.211, {"provincie": "Gelderland"}),
    ("Tilburg", "stad", 5.087, 51.560, {"provincie": "Noord-Brabant"}),
    ("Arnhem", "stad", 5.898, 51.985, {"provincie": "Gelderland", "provinciehoofdstad": True}),
    ("Assen", "stad", 6.562, 52.993, {"provincie": "Drenthe", "provinciehoofdstad": True}),
    ("Kampen", "stad", 5.911, 52.555, {"provincie": "Overijssel"}),
    ("Bergen op Zoom", "stad", 4.292, 51.495, {"provincie": "Noord-Brabant"}),
    ("Leeuwarden", "stad", 5.799, 53.201, {"alt": ["Ljouwert"], "provincie": "Fryslân", "provinciehoofdstad": True}),
    ("Utrecht", "stad", 5.121, 52.091, {"slonaam": "Utrecht (stad)", "provincie": "Utrecht", "provinciehoofdstad": True}),
    ("Breda", "stad", 4.776, 51.589, {"provincie": "Noord-Brabant"}),
    ("Veendam", "stad", 6.876, 53.106, {"provincie": "Groningen"}),
    ("Delft", "stad", 4.358, 52.012, {"provincie": "Zuid-Holland"}),
    ("Lelystad", "stad", 5.471, 52.518, {"provincie": "Flevoland", "provinciehoofdstad": True}),
    ("Delfzijl", "stad", 6.927, 53.330, {"provincie": "Groningen"}),
    ("Venlo", "stad", 6.172, 51.370, {"provincie": "Limburg"}),
    ("Den Haag", "stad", 4.300, 52.080, {"alt": ["'s-Gravenhage"], "provincie": "Zuid-Holland", "provinciehoofdstad": True, "regeringszetel": True}),
    ("Den Helder", "stad", 4.760, 52.958, {"provincie": "Noord-Holland"}),
    ("Maastricht", "stad", 5.691, 50.851, {"provincie": "Limburg", "provinciehoofdstad": True}),
    ("Vlissingen", "stad", 3.573, 51.443, {"provincie": "Zeeland"}),
    ("Deventer", "stad", 6.163, 52.255, {"provincie": "Overijssel"}),
    ("Doetinchem", "stad", 6.289, 51.965, {"provincie": "Gelderland"}),
    ("Meppel", "stad", 6.194, 52.696, {"provincie": "Drenthe"}),
    ("Dordrecht", "stad", 4.690, 51.813, {"provincie": "Zuid-Holland"}),
    ("Middelburg", "stad", 3.614, 51.499, {"provincie": "Zeeland", "provinciehoofdstad": True}),
    ("Wageningen", "stad", 5.664, 51.970, {"provincie": "Gelderland"}),
    ("Drachten", "stad", 6.098, 53.107, {"provincie": "Fryslân"}),
    ("Zaandam", "stad", 4.826, 52.439, {"provincie": "Noord-Holland"}),
    ("Eindhoven", "stad", 5.478, 51.441, {"provincie": "Noord-Brabant"}),
    ("Nijmegen", "stad", 5.853, 51.842, {"provincie": "Gelderland"}),
    ("Zoetermeer", "stad", 4.494, 52.057, {"provincie": "Zuid-Holland"}),
    ("Emmeloord", "stad", 5.749, 52.711, {"provincie": "Flevoland"}),
    ("Emmen", "stad", 6.906, 52.786, {"provincie": "Drenthe"}),
    ("Enkhuizen", "stad", 5.293, 52.703, {"provincie": "Noord-Holland"}),
    ("Enschede", "stad", 6.894, 52.221, {"provincie": "Overijssel"}),
    ("Zutphen", "stad", 6.196, 52.139, {"provincie": "Gelderland"}),
    ("Oss", "stad", 5.518, 51.765, {"provincie": "Noord-Brabant"}),
    ("Zwolle", "stad", 6.094, 52.516, {"provincie": "Overijssel", "provinciehoofdstad": True}),
    ("Purmerend", "stad", 4.950, 52.505, {"provincie": "Noord-Holland"}),
    ("Leiden", "stad", 4.497, 52.160, {"provincie": "Zuid-Holland"}),
    # luchthaven / infrastructuur
    ("Schiphol", "luchthaven", 4.764, 52.308, {}),
    ("Afsluitdijk", "dijk", 5.150, 53.000, {}),
    # eilanden
    ("Schiermonnikoog", "eiland", 6.200, 53.480, {}),
    ("Ameland", "eiland", 5.750, 53.450, {}),
    ("Terschelling", "eiland", 5.350, 53.400, {}),
    ("Texel", "eiland", 4.800, 53.080, {}),
    ("Vlieland", "eiland", 4.980, 53.270, {}),
    # wateren
    ("IJssel", "rivier", 6.120, 52.400, {"rivierref": "IJssel"}),
    ("Lek", "rivier", 4.950, 51.950, {"rivierref": "Lek"}),
    ("Maas", "rivier", 5.550, 51.780, {"rivierref": "Maas"}),
    ("Waal", "rivier", 5.400, 51.850, {"rivierref": "Waal"}),
    ("Neder-Rijn", "rivier", 5.700, 51.970, {"alt": ["Nederrijn"], "rivierref": "Nederrijn"}),
    ("Amsterdam-Rijnkanaal", "kanaal", 5.020, 52.200, {}),
    ("Noordzeekanaal", "kanaal", 4.700, 52.460, {}),
    ("Nieuwe Waterweg", "kanaal", 4.200, 51.950, {}),
    ("IJsselmeer", "meer", 5.350, 52.800, {}),
    ("Markermeer", "meer", 5.250, 52.550, {}),
    ("Waddenzee", "zee", 5.400, 53.250, {}),
    ("Westerschelde", "zeearm", 3.800, 51.400, {}),
    ("Oosterschelde", "zeearm", 3.950, 51.580, {}),
    # gebieden
    ("Randstad", "regio", 4.700, 52.100, {}),
    ("Rijnmond", "regio", 4.300, 51.900, {}),
    ("Twente", "regio", 6.750, 52.300, {}),
    ("Veluwe", "regio", 5.850, 52.200, {}),
    ("Biesbos", "natuurgebied", 4.800, 51.750, {"alt": ["Biesbosch"]}),
    ("Haarlemmermeer", "polder", 4.680, 52.300, {}),
    ("Zeeuws-Vlaanderen", "regio", 3.800, 51.280, {}),
    ("Vaalserberg", "berg", 6.021, 50.755, {"hoogte_m": 323}),
]

# Extra Nederland voor examendomein E (niet op de SLO-basislijst)
NL_EXTRA = [
    ("Zuidwestelijke Delta", "delta", 4.000, 51.650, {"doelen": ["H-E1", "V-E1", "KD25B"]}),
    ("IJsselmeergebied", "regio", 5.400, 52.700, {"doelen": ["H-E1", "V-E1"]}),
    ("Haringvliet", "zeearm", 4.150, 51.800, {"doelen": ["H-E1", "V-E1"]}),
    ("Hollandsch Diep", "zeearm", 4.550, 51.700, {"doelen": ["H-E1", "V-E1"]}),
    ("Grevelingen", "meer", 3.950, 51.750, {"doelen": ["H-E1", "V-E1"]}),
    ("Volkerak", "meer", 4.300, 51.650, {"doelen": ["H-E1", "V-E1"]}),
    ("Oosterscheldekering", "waterkering", 3.690, 51.650, {"doelen": ["H-E1", "V-E1", "KD25B"]}),
    ("Maeslantkering", "waterkering", 4.160, 51.955, {"doelen": ["H-E1", "V-E1", "KD25B"]}),
    ("Haringvlietdam", "waterkering", 4.040, 51.830, {"doelen": ["H-E1", "V-E1"]}),
    ("Houtribdijk", "dijk", 5.380, 52.580, {"doelen": ["H-E1", "V-E1"]}),
    ("Lobith", "plaats", 6.110, 51.862, {"doelen": ["H-E1", "V-E1"], "toelichting": "Hier stroomt de Rijn Nederland binnen; meetpunt voor de rivierafvoer."}),
    ("Eijsden", "plaats", 5.720, 50.775, {"doelen": ["H-E1", "V-E1"], "toelichting": "Hier stroomt de Maas Nederland binnen."}),
    ("Pannerdensch Kanaal", "rivier", 6.040, 51.890, {"doelen": ["H-E1", "V-E1"]}),
    ("Bergsche Maas", "rivier", 5.000, 51.720, {"doelen": ["H-E1", "V-E1"]}),
    ("Noordwaard", "rivierproject", 4.850, 51.770, {"doelen": ["H-E1", "V-E1"], "toelichting": "Ruimte voor de Rivier: polder die bij hoogwater mag overstromen."}),
    ("Spiegelwaal", "rivierproject", 5.840, 51.852, {"doelen": ["H-E1", "V-E1"], "toelichting": "Ruimte voor de Rivier bij Nijmegen: nevengeul in de Waal."}),
    ("Zandmotor", "kustproject", 4.190, 52.050, {"doelen": ["H-E1", "V-E1", "KD25B"]}),
    ("Lauwersmeer", "meer", 6.200, 53.370, {"doelen": ["H-E1", "V-E1"]}),
    ("Eems-Dollard", "zeearm", 7.050, 53.280, {"doelen": ["H-E1", "V-E1"], "alt": ["Dollard"]}),
    ("Groene Hart", "regio", 4.750, 52.050, {"doelen": ["KD25C", "H-E2", "V-E1"]}),
    ("Noordoostpolder", "polder", 5.750, 52.700, {"doelen": ["KD25C", "H-E1", "V-E1"]}),
    ("Flevopolder", "polder", 5.500, 52.420, {"doelen": ["KD25C", "H-E1", "V-E1"]}),
    ("Betuwe", "regio", 5.400, 51.900, {"doelen": ["KD25C", "H-E1"]}),
    ("Achterhoek", "regio", 6.500, 51.970, {"doelen": ["KD25C"]}),
    ("Westland", "regio", 4.220, 52.000, {"doelen": ["KD25C", "KD25B"]}),
    ("Zuid-Limburg", "regio", 5.850, 50.850, {"doelen": ["KD25C"]}),
    ("Peel", "regio", 5.850, 51.400, {"doelen": ["KD25C"]}),
    ("Hondsrug", "regio", 6.800, 52.900, {"doelen": ["KD25C"]}),
    ("Het Gooi", "regio", 5.200, 52.250, {"doelen": ["KD25C"]}),
    ("Brainport Eindhoven", "regio", 5.470, 51.450, {"doelen": ["KD25C", "H-B2", "V-B1"]}),
    ("Port of Rotterdam (Maasvlakte)", "haven", 4.030, 51.960, {"doelen": ["KD25C", "H-B2", "V-B1"], "alt": ["Maasvlakte"]}),
]

# ---------------------------------------------------------------- Europa / wereld: SLO-namen die niet direct in Natural Earth zitten
MANUAL = [
    # Europa
    ("Engeland", "landsdeel", -1.50, 52.80, {"land": "GBR", "slo": "EUROPA"}),
    ("Schotland", "landsdeel", -4.20, 56.80, {"land": "GBR", "slo": "EUROPA"}),
    ("Vlaanderen", "regio", 4.20, 51.00, {"land": "BEL", "slo": "EUROPA"}),
    ("Wallonië", "regio", 5.00, 50.35, {"land": "BEL", "slo": "EUROPA"}),
    ("Ruhrgebied", "regio", 7.20, 51.48, {"land": "DEU", "slo": "EUROPA"}),
    ("Scandinavië", "regio", 15.00, 63.00, {"slo": "EUROPA"}),
    ("Het Kanaal", "zeestraat", -1.50, 50.20, {"alt": ["Kanaal"], "slo": "EUROPA"}),
    ("Straat van Gibraltar", "zeestraat", -5.60, 35.95, {"slo": "EUROPA"}),
    ("Sicilië", "eiland", 14.15, 37.55, {"land": "ITA", "slo": "EUROPA"}),
    ("Ardennen", "gebergte", 5.60, 50.10, {"slo": "EUROPA"}),
    ("Oeral", "gebergte", 59.50, 58.00, {"alt": ["Oeralgebergte"], "slo": "EUROPA"}),
    # Wereld
    ("Amerika", "werelddeel", -90.00, 15.00, {"slo": "WERELD", "toelichting": "Noord- en Zuid-Amerika samen."}),
    ("Midden-Oosten", "regio", 45.00, 29.00, {"slo": "WERELD"}),
    ("Siberië", "regio", 100.00, 62.00, {"land": "RUS", "slo": "WERELD"}),
    ("Alaska", "staat", -152.00, 64.00, {"land": "USA", "slo": "WERELD"}),
    ("Californië", "staat", -119.50, 37.20, {"land": "USA", "slo": "WERELD"}),
    ("Hawaii", "eilandengroep", -157.50, 20.60, {"land": "USA", "slo": "WERELD"}),
    ("Java", "eiland", 110.00, -7.30, {"land": "IDN", "slo": "WERELD"}),
    ("Molukken", "eilandengroep", 128.50, -3.00, {"land": "IDN", "slo": "WERELD"}),
    ("Panamakanaal", "kanaal", -79.70, 9.10, {"slo": "WERELD", "doelen": ["H-B2", "V-B1"]}),
    ("Suezkanaal", "kanaal", 32.35, 30.50, {"slo": "WERELD", "doelen": ["H-B2", "V-B1"]}),
    ("Mekka", "stad", 39.826, 21.423, {"land": "SAU", "slo": "WERELD"}),
    # extra zeestraten voor handel (H-B2 / V-B1)
    ("Straat Malakka", "zeestraat", 100.50, 3.00, {"doelen": ["H-B2", "V-B1"]}),
    ("Straat van Hormuz", "zeestraat", 56.40, 26.50, {"doelen": ["H-B2", "V-B1"]}),
    ("Bosporus", "zeestraat", 29.05, 41.12, {"doelen": ["H-B2", "V-B1"]}),
    ("Bab-el-Mandeb", "zeestraat", 43.40, 12.60, {"doelen": ["H-B2", "V-B1"]}),
    ("Straat Dover", "zeestraat", 1.45, 51.00, {"doelen": ["H-B2", "V-B1"], "alt": ["Nauw van Calais"]}),
    ("Kaap de Goede Hoop", "kaap", 18.47, -34.36, {"doelen": ["H-B2", "V-B1"]}),
    # bekende toppen die niet in Natural Earth staan (hoogte in m, afgerond)
    ("Fuji", "vulkaan", 138.73, 35.36, {"land": "JPN", "hoogte_m": 3776, "doelen": ["H-C2", "V-C1", "KD25B"]}),
    ("Chimborazo", "vulkaan", -78.82, -1.47, {"land": "ECU", "hoogte_m": 6263, "doelen": ["H-C2", "V-C1", "V-D1"]}),
    ("Cotopaxi", "vulkaan", -78.44, -0.68, {"land": "ECU", "hoogte_m": 5897, "doelen": ["H-C2", "V-C1", "V-D1"]}),
    ("Huascarán", "berg", -77.60, -9.12, {"land": "PER", "hoogte_m": 6768, "doelen": ["H-C2", "V-C1", "V-D1"]}),
    ("Ojos del Salado", "vulkaan", -68.54, -27.11, {"land": "CHL", "hoogte_m": 6893, "doelen": ["H-C2", "V-C1", "V-D1"]}),
    ("Pico de Orizaba", "vulkaan", -97.27, 19.03, {"land": "MEX", "hoogte_m": 5636, "doelen": ["H-C2", "V-C1"]}),
    ("Pico da Neblina", "berg", -66.00, 0.80, {"land": "BRA", "hoogte_m": 2995, "doelen": ["H-D1", "V-D1"], "toelichting": "Hoogste berg van Brazilië."}),
    ("Matterhorn", "berg", 7.66, 45.98, {"land": "CHE", "hoogte_m": 4478, "doelen": ["H-C2", "V-C1"]}),
    ("Zugspitze", "berg", 10.98, 47.42, {"land": "DEU", "hoogte_m": 2962, "doelen": ["H-C2", "V-C1"]}),
    ("Vesuvius", "vulkaan", 14.43, 40.82, {"land": "ITA", "hoogte_m": 1281, "doelen": ["H-C2", "V-C1", "KD25B"]}),
]

# ---------------------------------------------------------------- Rivieren (NE-naam -> Nederlandse naam)
RIVIEREN = [
    ("Amazonas", "Amazone", ["Amazonas"]), ("Nile", "Nijl", []), ("Mississippi", "Mississippi", []),
    ("Missouri", "Missouri", []), ("Danube", "Donau", []), ("Rhine", "Rijn", ["Rhein"]),
    ("Volga", "Wolga", ["Volga"]), ("Chang Jiang", "Chang Jiang", ["Blauwe Rivier", "Yangtze", "Jangtsekiang"]),
    ("Huang", "Gele Rivier", ["Huang He"]), ("Ganges", "Ganges", []), ("Indus", "Indus", []),
    ("Brahmaputra", "Brahmaputra", []), ("Mekong", "Mekong", []), ("Congo", "Kongo", ["Congo"]),
    ("Niger", "Niger", []), ("Zambezi", "Zambezi", []), ("Orange", "Oranjerivier", []),
    ("Limpopo", "Limpopo", []), ("Tigris", "Tigris", []), ("Euphrates", "Eufraat", []),
    ("Jordan", "Jordaan", []), ("Ob", "Ob", []), ("Yenisey", "Jenisej", []), ("Lena", "Lena", []),
    ("Amur", "Amoer", []), ("Mackenzie", "Mackenzie", []), ("Yukon", "Yukon", []),
    ("St. Lawrence", "Sint-Laurensrivier", []), ("Colorado", "Colorado", []),
    ("Rio Grande", "Rio Grande", ["Río Bravo"]), ("Columbia", "Columbia", []),
    ("Paraná", "Paraná", []), ("Uruguay", "Uruguay", []),
    ("Orinoco", "Orinoco", []), ("Magdalena", "Magdalena", []), ("São  Francisco", "São Francisco", []),
    ("Madeira", "Madeira", []), ("Negro", "Rio Negro", []), ("Tocantins", "Tocantins", []),
    ("Xingu", "Xingu", []), ("Tapajós", "Tapajós", []), ("Araguaia", "Araguaia", []),
    ("Murray", "Murray", []), ("Thames", "Theems", []), ("Seine", "Seine", []), ("Loire", "Loire", []),
    ("Rhône", "Rhône", []), ("Po", "Po", []), ("Elbe", "Elbe", []), ("Oder", "Oder", []),
    ("Vistula", "Wisła", ["Weichsel"]), ("Dnipro", "Dnjepr", []), ("Don", "Don", []),
    ("Ebro", "Ebro", []), ("Tejo", "Taag", ["Tejo"]), ("Maas", "Maas", ["Meuse"]),
    ("Waal", "Waal", []), ("Schelde", "Schelde", ["Escaut"]), ("IJssel", "IJssel", []), ("Lek", "Lek", []), ("Nederrijn", "Neder-Rijn", []),
    ("Ural", "Oeral (rivier)", []), ("Irrawaddy", "Irrawaddy", []), ("Salween", "Salween", []),
    ("Okavango", "Okavango", []), ("Dniester", "Dnjestr", []), ("Shatt al Arab", "Shatt al-Arab", []),
]
RIVIER_DOELEN = {
    "Rijn": ["H-E1", "V-E1"], "Maas": ["H-E1", "V-E1"], "Waal": ["H-E1", "V-E1"], "IJssel": ["H-E1", "V-E1"],
    "Lek": ["H-E1", "V-E1"], "Neder-Rijn": ["H-E1", "V-E1"],
    "Amazone": ["H-D1", "V-D1"], "Rio Negro": ["H-D1", "V-D1"], "Madeira": ["H-D1", "V-D1"],
    "Tocantins": ["H-D1", "V-D1"], "Xingu": ["H-D1", "V-D1", "H-D2"], "Tapajós": ["H-D1", "V-D1"],
    "Araguaia": ["H-D1", "V-D1"], "São Francisco": ["H-D1", "V-D1"], "Paraná": ["H-D1", "V-D1"],
    "Uruguay": ["H-D1", "V-D1"], "Orinoco": ["V-D1"], "Magdalena": ["V-D1"],
    "Rio Grande": ["H-B1"], "Colorado": ["H-B1"],
}

# ---------------------------------------------------------------- Brazilië
BRAZILIE_REGIO = {
    "Noord": {"pt": "Norte", "staten": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"], "punt": [-60.0, -4.0]},
    "Noordoost": {"pt": "Nordeste", "staten": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"], "punt": [-40.5, -8.0]},
    "Centraal-West": {"pt": "Centro-Oeste", "staten": ["DF", "GO", "MT", "MS"], "punt": [-53.0, -15.5]},
    "Zuidoost": {"pt": "Sudeste", "staten": ["ES", "MG", "RJ", "SP"], "punt": [-45.5, -20.0]},
    "Zuid": {"pt": "Sul", "staten": ["PR", "RS", "SC"], "punt": [-52.0, -27.5]},
}
BRAZILIE = [
    ("Amazonegebied", "bioom", -62.0, -4.0, {"alt": ["Amazônia", "Amazoneregenwoud"], "doelen": ["H-D1", "H-D2", "V-D1", "V-D2", "KD25B"]}),
    ("Cerrado", "bioom", -48.0, -14.0, {"toelichting": "Tropische savanne; landbouwgebied (soja).", "doelen": ["H-D1", "H-D2", "V-D1"]}),
    ("Caatinga", "bioom", -40.0, -8.0, {"toelichting": "Droog doornstruikgebied in het noordoosten.", "doelen": ["H-D1", "V-D1"]}),
    ("Mata Atlântica", "bioom", -43.0, -21.5, {"alt": ["Atlantisch regenwoud"], "doelen": ["H-D1", "V-D1"]}),
    ("Pantanal", "bioom", -57.0, -18.0, {"toelichting": "Groot moerasgebied.", "doelen": ["H-D1", "V-D1"]}),
    ("Pampa", "bioom", -54.0, -30.5, {"alt": ["Pampas"], "doelen": ["H-D1", "V-D1"]}),
    ("Sertão", "regio", -40.0, -9.0, {"toelichting": "Droog binnenland van het noordoosten.", "doelen": ["H-D1", "V-D1"]}),
    ("Zona da Mata", "regio", -35.5, -8.0, {"toelichting": "Vochtige kuststrook in het noordoosten.", "doelen": ["H-D1"]}),
    ("Itaipudam", "stuwdam", -54.59, -25.41, {"alt": ["Itaipu"], "doelen": ["H-D1", "V-D1", "V-D2"]}),
    ("Belo Montedam", "stuwdam", -51.77, -3.13, {"alt": ["Belo Monte"], "doelen": ["H-D2", "V-D2"]}),
    ("Carajás", "mijngebied", -50.20, -6.05, {"toelichting": "Grote ijzerertsmijn in Pará.", "doelen": ["H-D1", "H-D2", "V-D2"]}),
    ("Transamazônica", "weg", -55.00, -4.50, {"alt": ["BR-230"], "toelichting": "Punt is een benadering; de weg loopt oost-west door het Amazonegebied.", "doelen": ["H-D2", "V-D2"]}),
    ("Brumadinho", "plaats", -44.20, -20.14, {"toelichting": "Dambreuk bij een ijzerertsmijn in 2019.", "doelen": ["H-D2", "V-D2"]}),
    ("Rocinha", "favela", -43.25, -22.99, {"toelichting": "Grote favela in Rio de Janeiro.", "doelen": ["H-D1", "V-D2"]}),
    ("Zona Franca de Manaus", "vrijhandelszone", -59.98, -3.12, {"alt": ["Vrijhandelszone Manaus"], "doelen": ["H-D1", "V-D1"]}),
]

# ---------------------------------------------------------------- Mexico – Verenigde Staten (H-B1)
GRENSPAREN = [
    ("Tijuana", "MEX", -117.02, 32.53, "San Diego", "USA", -117.16, 32.72),
    ("Mexicali", "MEX", -115.47, 32.62, "Calexico", "USA", -115.50, 32.68),
    ("Nogales (Mexico)", "MEX", -110.94, 31.31, "Nogales (VS)", "USA", -110.94, 31.34),
    ("Ciudad Juárez", "MEX", -106.45, 31.69, "El Paso", "USA", -106.44, 31.76),
    ("Nuevo Laredo", "MEX", -99.51, 27.48, "Laredo", "USA", -99.50, 27.51),
    ("Reynosa", "MEX", -98.28, 26.09, "McAllen", "USA", -98.23, 26.20),
    ("Matamoros", "MEX", -97.50, 25.87, "Brownsville", "USA", -97.50, 25.90),
]
GRENSSTATEN = {
    "MEX": ["Baja California", "Sonora", "Chihuahua", "Coahuila", "Nuevo León", "Tamaulipas"],
    "USA": ["California", "Arizona", "New Mexico", "Texas"],
}
STAAT_NL = {"California": "Californië"}
MEXICO_VS_EXTRA = [
    ("Monterrey", "stad", -100.31, 25.67, {"land": "MEX", "toelichting": "Industriestad met veel maquiladora's."}),
    ("Sonorawoestijn", "woestijn", -112.5, 32.0, {}),
    ("Chihuahuawoestijn", "woestijn", -105.0, 29.5, {}),
    ("Golf van Californië", "golf", -110.5, 27.5, {"alt": ["Zee van Cortés"]}),
]

# ---------------------------------------------------------------- Platen (PB2002, ODC-By)
PLATEN = {
    "Pacific": "Pacifische plaat", "North America": "Noord-Amerikaanse plaat", "South America": "Zuid-Amerikaanse plaat",
    "Eurasia": "Euraziatische plaat", "Africa": "Afrikaanse plaat", "Somalia": "Somalische plaat",
    "Arabia": "Arabische plaat", "India": "Indische plaat", "Australia": "Australische plaat",
    "Antarctica": "Antarctische plaat", "Nazca": "Nazcaplaat", "Cocos": "Cocosplaat",
    "Caribbean": "Caribische plaat", "Philippine Sea": "Filipijnse plaat", "Juan de Fuca": "Juan de Fucaplaat",
    "Scotia": "Scotiaplaat", "Anatolia": "Anatolische plaat", "Sunda": "Sundaplaat", "Okhotsk": "Ochotskplaat",
}

# Nederlandse namen voor continenten en VN-subregio's
CONTINENT_NL = {"Africa": "Afrika", "Asia": "Azië", "Europe": "Europa", "North America": "Noord-Amerika",
                "South America": "Zuid-Amerika", "Oceania": "Oceanië", "Antarctica": "Antarctica",
                "Seven seas (open ocean)": "Oceanië", "Americas": "Amerika"}
SUBREGIO_NL = {
    "Northern Europe": "Noord-Europa", "Western Europe": "West-Europa", "Southern Europe": "Zuid-Europa",
    "Eastern Europe": "Oost-Europa", "Central Europe": "Centraal-Europa", "Southeast Europe": "Zuidoost-Europa",
    "Northern Africa": "Noord-Afrika", "Western Africa": "West-Afrika",
    "Middle Africa": "Centraal-Afrika", "Eastern Africa": "Oost-Afrika", "Southern Africa": "Zuidelijk Afrika",
    "Western Asia": "West-Azië", "Central Asia": "Centraal-Azië", "Southern Asia": "Zuid-Azië",
    "Eastern Asia": "Oost-Azië", "South-Eastern Asia": "Zuidoost-Azië", "Northern America": "Noord-Amerika",
    "North America": "Noord-Amerika", "Central America": "Midden-Amerika", "Caribbean": "Caribisch gebied",
    "South America": "Zuid-Amerika", "Australia and New Zealand": "Australië en Nieuw-Zeeland",
    "Melanesia": "Melanesië", "Micronesia": "Micronesië", "Polynesia": "Polynesië", "Antarctica": "Antarctica",
}
LANDNAAM_FIX = {"COD": "Congo-Kinshasa", "COG": "Congo-Brazzaville", "BHS": "Bahama's", "FSM": "Micronesia",
                "MAF": "Saint-Martin", "PSE": "Palestina", "MAC": "Macau", "IMN": "Man"}
