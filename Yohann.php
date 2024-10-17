<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Contact</title>
    <link rel="stylesheet" href="cv.css">
    </head>
    <body>
        <?php
        $prenom = "Yohann";
        echo "Hello".$prenom;
        ?>
    <h2>Pour revenir à la page précedente cliquez <a href="index.html">ici</a></h2>
    <ul>
        <li><strong>Mon adresse mail personelle</strong> : <a href="mailto:yohann.marant@gmail.com">yohann.marant@gmail.com</a>
    </ul>
    <br>
    <strong>Pour accéder à la page visite, cliquez</strong> <a href="visite.html">ici</a>
    <br><br>
    <form action="mailto:yohann.marant@gmail.com" method="post">
        <label for="nom"> <strong>Nom : </strong></label><input type="text" id="nom" name="nom" placeholder="Entrez votre nom ici" autofocus>
    <br><br>
        <label for="Prenom"><strong> Prenom : </strong></label><input type="text" id="Prenom" name="Prenom" placeholder="Entrez votre prénom ici">
    <br><br> 
    <label><strong>Civilite :</strong></label>
        M.<input type="radio" id="M." name="Civilite">
        Mme<input type="radio" id="Mme" name="Civilite">    
    <br><br>
    <strong> Date De Naissance : </strong> <input type="date" id="date" name="date">
    <br><br>
    <strong> Pays : </strong><select>
        <option value="France">France</option>
        <option value="Belgique">Belgique</option>
        <option value="Royaume-Uni">Royaume-Uni</option>
        <option value="Espagne">Espagne</option>
    </select><br><br>
        <label for="email"> <strong>Email :</strong> </label><input type="email" id="email" name="email" placeholder="Entrez votre adresse email" pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$" required>
    <br><br>
    <label for="mdp"> <strong>Mot de passe :</strong> </label> <input type="password" id="mdp" name="mdp" placeholder="Entrez votre mot de passe">
    <br><br>
        <label for="tel"> <strong>Telephone : </strong></label><input type="tel" id="tel" name="tel" placeholder="Numero de telephone">
    <br><br>
    <strong>Newsletter : </strong><input type="checkbox">
    <br><br>
    <strong>Message : </strong><textarea></textarea><br>
    <input type="submit" value="Envoyer le message">
    <br>
    Bonjour <p id="valuePrenom"></p>
    <script type="text/javascript">
        document.getElementById("Prenom").addEventListener("input", function(){
            document.getElementById("valuePrenom").innerHTML = document.getElementById("Prenom").value;
            // console.log(document.getElementById("Prenom").value);
        });

        //  var Prenom = prompt("Donnez votre prenom");
        //  while(Prenom == ""){
            //  Prenom = prompt("Donnez votre prenom");
        //  }
        //  if(Prenom == null){
           //   document.write(" illustre inconnu(e) ")
        //  }
     // var Enigme = prompt("Capitale de l'Espagne");
     // while(Enigme !="Madrid" && Enigme !="madrid"){
        // Enigme = prompt("Capitale de l'Espagne");
     // }
     // document.write("La capitale est " + Enigme);

    </script>
    </body>
</html>